"""
FlowManager: Manages conversation flow state transitions during a live call session.
Tracks the current node, processes transitions based on LLM output or DTMF input,
and emits events to WebSocket clients.
"""
import asyncio
import json
import logging
from typing import Any, Callable, Dict, List, Optional

from app.flows.flow_definitions import FLOWS

logger = logging.getLogger(__name__)


class FlowNode:
    """Represents a single node in the conversation flow."""

    def __init__(self, data: Dict[str, Any]):
        self.id: str = data["id"]
        self.label: str = data["label"]
        self.type: str = data["type"]
        self.description: str = data["description"]
        self.system_prompt_snippet: str = data["system_prompt_snippet"]
        self.position: Dict[str, int] = data["position"]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "type": self.type,
            "description": self.description,
            "system_prompt_snippet": self.system_prompt_snippet,
            "position": self.position,
        }


class FlowEdge:
    """Represents a transition edge between two nodes."""

    def __init__(self, data: Dict[str, Any]):
        self.id: str = data["id"]
        self.source: str = data["source"]
        self.target: str = data["target"]
        self.label: str = data["label"]
        self.type: str = data["type"]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source,
            "target": self.target,
            "label": self.label,
            "type": self.type,
        }


class FlowManager:
    """
    Manages the state of a conversation flow for a single call session.

    Responsibilities:
    - Track current node
    - Process LLM-based transitions
    - Process DTMF-based transitions
    - Emit node_change events to WebSocket callbacks
    - Build system prompts from node snippets
    """

    def __init__(
        self,
        flow_id: str,
        session_id: str,
        customer_context: Dict[str, Any],
        on_node_change: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ):
        if flow_id not in FLOWS:
            raise ValueError(f"Unknown flow_id: {flow_id}")

        self.flow_id = flow_id
        self.session_id = session_id
        self.customer_context = customer_context
        self.on_node_change = on_node_change
        self._flow_def = FLOWS[flow_id]

        # Build node and edge maps
        self.nodes: Dict[str, FlowNode] = {
            n["id"]: FlowNode(n)
            for n in self._flow_def["nodes"]
        }
        self.edges: List[FlowEdge] = [
            FlowEdge(e) for e in self._flow_def["edges"]
        ]

        # Find starting node (type == 'start')
        start_nodes = [n for n in self.nodes.values() if n.type == "start"]
        if not start_nodes:
            raise ValueError(f"Flow {flow_id} has no start node")
        self.current_node_id: str = start_nodes[0].id
        self.node_history: List[str] = [self.current_node_id]
        self.turn_count: int = 0

    @property
    def current_node(self) -> FlowNode:
        return self.nodes[self.current_node_id]

    def get_outgoing_edges(self, node_id: str) -> List[FlowEdge]:
        """Return all edges departing from the given node."""
        return [e for e in self.edges if e.source == node_id]

    def get_system_prompt(self) -> str:
        """Build full system prompt for the current node, injecting customer context."""
        node = self.current_node
        base_prompt = self._build_base_prompt()
        node_instruction = self._interpolate(node.system_prompt_snippet)

        return (
            f"{base_prompt}\n\n"
            f"## Current Step: {node.label}\n"
            f"{node.description}\n\n"
            f"### Instructions:\n{node_instruction}\n\n"
            f"{self._get_transition_hints()}"
        )

    def _build_base_prompt(self) -> str:
        ctx = self.customer_context
        return (
            "You are a professional loan collection agent for an Indian NBFC. "
            "You speak in a natural mix of Hindi and English (Hinglish). "
            "You are empathetic but firm. You never threaten or harass.\n\n"
            "## CRITICAL — Language and Script Rule:\n"
            "You are speaking through a Hindi TTS (text-to-speech) engine. "
            "ALL Hindi words MUST be written in Devanagari script. "
            "NEVER write Hindi in Roman transliteration — the TTS engine will mispronounce it. "
            "For example: write 'मैं' not 'main', 'आप' not 'aap', 'नमस्ते' not 'Namaste', "
            "'हूँ' not 'hoon', 'क्या' not 'kya', 'धन्यवाद' not 'dhanyawad', "
            "'नहीं' not 'nahi', 'ठीक है' not 'theek hai', 'बात' not 'baat'. "
            "English words (loan, EMI, CIBIL, UTR, UPI, receipt, account, credit score) "
            "may remain in English as the TTS handles them correctly.\n\n"
            f"## Customer Information:\n"
            f"- Name: {ctx.get('name', 'Customer')}\n"
            f"- Loan Amount: Rs.{ctx.get('loan_amount', '0')}\n"
            f"- Outstanding Amount: Rs.{ctx.get('outstanding_amount', '0')}\n"
            f"- Days Past Due (DPD): {ctx.get('dpd', 0)} days\n"
            f"- Due Date: {ctx.get('due_date', 'N/A')}\n"
            f"- Preferred Language: {ctx.get('preferred_language', 'Hindi')}\n\n"
            "## Guidelines:\n"
            "- Always greet warmly and identify yourself\n"
            "- Be empathetic but professional\n"
            "- Speak naturally, mixing Devanagari Hindi with English where appropriate\n"
            "- Never threaten or harass\n"
            "- Always offer payment options\n"
            "- STRICT OUTPUT RULE: 1-2 sentences maximum. Never exceed 30 words.\n"
            "- Output ONLY the spoken conversational text. Never output reasoning, instructions, or labels.\n"
            "- Capture commitment amounts and dates accurately\n"
        )

    def _interpolate(self, template: str) -> str:
        """Replace {placeholder} tokens in prompt snippets with customer data."""
        ctx = self.customer_context
        substitutions = {
            "customer_name": ctx.get("name", "Customer"),
            "loan_amount": ctx.get("loan_amount", "0"),
            "outstanding_amount": ctx.get("outstanding_amount", "0"),
            "dpd": str(ctx.get("dpd", 0)),
            "due_date": str(ctx.get("due_date", "N/A")),
            "partial_amount": str(int(float(ctx.get("outstanding_amount", 0)) * 0.3)),
            "minimum_amount": str(int(float(ctx.get("outstanding_amount", 0)) * 0.2)),
            "settlement_amount": str(int(float(ctx.get("outstanding_amount", 0)) * 0.7)),
            "minimum_settlement": str(int(float(ctx.get("outstanding_amount", 0)) * 0.5)),
            "upi_id": ctx.get("upi_id", "company@upi"),
            "account_number": ctx.get("account_number", "XXXX"),
            "helpline_number": ctx.get("helpline_number", "1800-XXX-XXXX"),
            "commitment_amount": ctx.get("commitment_amount", "agreed amount"),
            "commitment_date": ctx.get("commitment_date", "agreed date"),
            "offer_days": "3",
            "payment_date": ctx.get("payment_date", "agreed date"),
        }
        result = template
        for key, value in substitutions.items():
            result = result.replace(f"{{{key}}}", str(value))
        return result

    def _get_transition_hints(self) -> str:
        """
        For decision nodes (multiple outgoing edges), embed the ACTUAL instructions
        for each branch so the LLM knows exactly what to say for each customer response.
        Single-edge nodes get no hint — the agent just progresses naturally.
        """
        outgoing = self.get_outgoing_edges(self.current_node_id)
        if not outgoing:
            return "## This is the final step. Wrap up the call gracefully."

        if len(outgoing) == 1:
            return ""  # Single path — no branching decision needed

        hints = "## IMPORTANT — How to respond based on the customer's answer:\n"
        for edge in outgoing:
            target = self.nodes.get(edge.target)
            if target:
                target_instruction = self._interpolate(target.system_prompt_snippet)
                hints += f"- If customer indicates '{edge.label}': {target_instruction}\n"
        return hints

    def transition_to(self, node_id: str) -> bool:
        """Manually transition to a specific node."""
        if node_id not in self.nodes:
            logger.warning(f"[FlowManager] Attempted transition to unknown node: {node_id}")
            return False

        previous = self.current_node_id
        self.current_node_id = node_id
        self.node_history.append(node_id)
        self.turn_count += 1

        logger.info(f"[FlowManager] Session {self.session_id}: {previous} → {node_id}")

        if self.on_node_change:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.ensure_future(
                        self._async_notify_node_change(previous, node_id)
                    )
                else:
                    loop.run_until_complete(
                        self._async_notify_node_change(previous, node_id)
                    )
            except Exception as e:
                logger.error(f"[FlowManager] Notify error: {e}")

        return True

    async def _async_notify_node_change(self, from_node: str, to_node: str) -> None:
        if self.on_node_change:
            await self.on_node_change(
                self.session_id,
                {
                    "type": "node_change",
                    "from_node": from_node,
                    "to_node": to_node,
                    "node": self.nodes[to_node].to_dict(),
                    "turn_count": self.turn_count,
                }
            )

    def process_dtmf(self, digit: str) -> Optional[str]:
        """
        Process a DTMF keypress and return the next node_id if a valid transition exists.
        DTMF transitions are labeled like 'Accepted (DTMF 1)' or 'DTMF 1'.
        """
        outgoing = self.get_outgoing_edges(self.current_node_id)
        for edge in outgoing:
            if edge.type == "dtmf" and digit in edge.label:
                self.transition_to(edge.target)
                return edge.target
        return None

    def process_llm_intent(self, intent: str) -> Optional[str]:
        """
        Process an intent from LLM analysis and return the next node_id.
        Intent should match edge labels (case-insensitive, partial match).
        """
        outgoing = self.get_outgoing_edges(self.current_node_id)
        intent_lower = intent.lower()

        for edge in outgoing:
            if edge.type == "llm":
                edge_label_lower = edge.label.lower()
                if any(word in intent_lower for word in edge_label_lower.split()):
                    self.transition_to(edge.target)
                    return edge.target

        # Default: advance to the first available LLM edge
        llm_edges = [e for e in outgoing if e.type == "llm"]
        if len(llm_edges) == 1:
            self.transition_to(llm_edges[0].target)
            return llm_edges[0].target

        return None

    def is_complete(self) -> bool:
        """Return True if the current node is an end node."""
        return self.current_node.type == "end"

    def get_state(self) -> Dict[str, Any]:
        """Return current flow state for status endpoint."""
        return {
            "flow_id": self.flow_id,
            "flow_name": self._flow_def["name"],
            "current_node": self.current_node.to_dict(),
            "node_history": self.node_history,
            "turn_count": self.turn_count,
            "is_complete": self.is_complete(),
            "session_id": self.session_id,
        }

    def process_single_edge_transition(self) -> Optional[str]:
        """
        If the current node has exactly one outgoing LLM edge, auto-advance to it.
        Called after the agent finishes speaking (on_assistant_turn_stopped) so that
        action nodes advance without waiting for a specific customer keyword.
        Does nothing for decision/multi-edge nodes or end nodes.
        """
        if self.current_node.type == "end":
            return None
        outgoing = [e for e in self.get_outgoing_edges(self.current_node_id) if e.type == "llm"]
        if len(outgoing) == 1:
            target = outgoing[0].target
            self.transition_to(target)
            return target
        return None

    def process_customer_response(self, text: str) -> Optional[str]:
        """
        Detect customer intent from their utterance and transition for decision nodes
        (nodes with multiple outgoing edges).  Called from on_user_turn_stopped.

        Handles:
        - Yes / No → route to positive / negative edge by label pattern
        - Payment / objection / callback keywords → route to matching edge
        Single-edge nodes are handled by process_single_edge_transition instead.
        """
        outgoing = [e for e in self.get_outgoing_edges(self.current_node_id) if e.type == "llm"]
        if len(outgoing) <= 1:
            return None  # Single-edge nodes handled after agent speaks

        text_lower = text.lower()
        words = set(text_lower.split())

        YES_WORDS = {"yes", "haan", "han", "ha", "bilkul", "zaroor", "ok",
                     "okay", "sure", "right", "correct", "done", "haa", "yep", "yup"}
        NO_WORDS  = {"no", "nahi", "nhi", "na", "nahin", "nope", "mat"}
        PAYMENT_WORDS   = {"payment", "paid", "bheja", "transfer", "upi", "neft"}
        OBJECTION_WORDS = {"problem", "issue", "unable", "cant", "emergency", "job", "medical"}
        CALLBACK_WORDS  = {"callback", "later", "busy"}

        is_yes     = bool(words & YES_WORDS) or "हाँ" in text or "हां" in text or "जी हाँ" in text
        is_no      = bool(words & NO_WORDS)  or "नहीं" in text
        has_payment   = any(w in text_lower for w in PAYMENT_WORDS) or "कर दिया" in text
        has_objection = any(w in text_lower for w in OBJECTION_WORDS)
        has_callback  = any(w in text_lower for w in CALLBACK_WORDS) or "बाद में" in text

        def label(e: FlowEdge) -> str:
            return e.label.lower()

        def is_negative_edge(e: FlowEdge) -> bool:
            return (label(e).startswith("no ") or "not " in label(e)
                    or "refused" in label(e) or "unavailable" in label(e))

        def edge_has(e: FlowEdge, *words: str) -> bool:
            return any(w in label(e) for w in words)

        # ── Specific intent matching first ────────────────────────────────
        if has_payment:
            for edge in outgoing:
                if edge_has(edge, "payment", "paid"):
                    self.transition_to(edge.target)
                    return edge.target

        if has_callback:
            for edge in outgoing:
                if edge_has(edge, "callback", "not available", "available"):
                    self.transition_to(edge.target)
                    return edge.target

        if has_objection:
            for edge in outgoing:
                if edge_has(edge, "objection", "problem"):
                    self.transition_to(edge.target)
                    return edge.target

        # ── Yes / No fallback ────────────────────────────────────────────
        if is_yes and not is_no:
            for edge in outgoing:
                if not is_negative_edge(edge):
                    self.transition_to(edge.target)
                    return edge.target

        if is_no and not is_yes:
            for edge in outgoing:
                if is_negative_edge(edge):
                    self.transition_to(edge.target)
                    return edge.target

        return None

    def get_all_nodes(self) -> List[Dict[str, Any]]:
        return [n.to_dict() for n in self.nodes.values()]

    def get_all_edges(self) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.edges]
