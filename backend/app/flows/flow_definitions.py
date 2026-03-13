"""
Pipecat-style conversation flow definitions for the loan collection AI agent.
Each flow is a directed graph with nodes (steps) and edges (transitions).
Node positions are ReactFlow-compatible.
"""

from typing import Any, Dict


FLOWS: Dict[str, Dict[str, Any]] = {

    # ──────────────────────── FLOW 1: Basic Payment Reminder ─────────────────────────
    "flow_basic": {
        "id": "flow_basic",
        "name": "Basic Payment Reminder",
        "description": "Simple payment reminder flow for DPD 0-7 days (Tier 1 customers).",
        "tier": "tier_1",
        "nodes": [
            {
                "id": "greeting",
                "label": "Greeting",
                "type": "start",
                "description": "Warm greeting and self-introduction as loan agent.",
                "system_prompt_snippet": (
                    "Greet the customer warmly in Hinglish. Say: 'Namaste! Main [Company] se bol raha/rahi hoon. "
                    "Kya aap {customer_name} ji bol rahe hain?' Wait for confirmation before proceeding."
                ),
                "position": {"x": 250, "y": 50},
            },
            {
                "id": "identity_verification",
                "label": "Identity Verification",
                "type": "action",
                "description": "Verify the customer's identity by confirming loan ID or date of birth.",
                "system_prompt_snippet": (
                    "Ask the customer to confirm their loan account number ending in last 4 digits of loan_id, "
                    "or their date of birth to verify identity. Do not proceed without verification."
                ),
                "position": {"x": 250, "y": 170},
            },
            {
                "id": "overdue_info",
                "label": "Overdue Information",
                "type": "action",
                "description": "Inform customer about the overdue EMI amount and due date.",
                "system_prompt_snippet": (
                    "Politely inform: 'Aapke loan account mein Rs.{outstanding_amount} outstanding hai jo "
                    "{dpd} din se overdue hai. Due date thi {due_date}.' Be factual and empathetic."
                ),
                "position": {"x": 250, "y": 290},
            },
            {
                "id": "payment_check",
                "label": "Payment Check",
                "type": "decision",
                "description": "Ask if the customer has already made the payment.",
                "system_prompt_snippet": (
                    "Ask: 'Kya aapne is amount ka payment kar diya hai?' "
                    "If YES → payment_made branch. If NO → commitment_request branch."
                ),
                "position": {"x": 250, "y": 410},
            },
            {
                "id": "payment_amount",
                "label": "Capture Payment Amount",
                "type": "action",
                "description": "Capture the payment amount already made by the customer.",
                "system_prompt_snippet": (
                    "Ask: 'Kitna payment kiya? Aur kab kiya?' Record the amount and date. "
                    "Ask for receipt/UTR number if available."
                ),
                "position": {"x": 80, "y": 530},
            },
            {
                "id": "receipt_check",
                "label": "Receipt Confirmation",
                "type": "action",
                "description": "Confirm payment receipt and UTR number.",
                "system_prompt_snippet": (
                    "Ask: 'Kya aapke paas payment ka receipt ya UTR number hai?' "
                    "Record it if provided. Confirm it will be verified within 24 hours."
                ),
                "position": {"x": 80, "y": 650},
            },
            {
                "id": "thank_payment",
                "label": "Thank for Payment",
                "type": "action",
                "description": "Thank customer for the payment and confirm account update.",
                "system_prompt_snippet": (
                    "Say: 'Bahut shukriya payment ke liye! Aapka account 24 ghante mein update ho jayega. "
                    "Koi aur help chahiye?' Proceed to farewell."
                ),
                "position": {"x": 80, "y": 770},
            },
            {
                "id": "commitment_request",
                "label": "Commitment Request",
                "type": "action",
                "description": "Request payment commitment with a specific date.",
                "system_prompt_snippet": (
                    "Say: 'Kya aap aaj ya kal payment kar sakte hain? Rs.{outstanding_amount} clear karna "
                    "bahut important hai credit score ke liye.' Ask for a commitment date."
                ),
                "position": {"x": 420, "y": 530},
            },
            {
                "id": "payment_options",
                "label": "Payment Options",
                "type": "action",
                "description": "Provide payment methods: UPI, NEFT, branch.",
                "system_prompt_snippet": (
                    "Provide options: 'Aap UPI se {upi_id} pe, ya NEFT se account {account_number} mein, "
                    "ya nearest branch mein payment kar sakte hain.' Ask if they need any other help."
                ),
                "position": {"x": 420, "y": 650},
            },
            {
                "id": "farewell",
                "label": "Farewell",
                "type": "end",
                "description": "Polite farewell and call wrap-up.",
                "system_prompt_snippet": (
                    "Say: 'Dhanyawad aapke samay ke liye. Koi bhi problem ho toh humara helpline "
                    "{helpline_number} pe call karein. Aapka din shubh ho!' End the call."
                ),
                "position": {"x": 250, "y": 870},
            },
        ],
        "edges": [
            {
                "id": "e_greeting_verify",
                "source": "greeting",
                "target": "identity_verification",
                "label": "Customer responds",
                "type": "llm",
            },
            {
                "id": "e_verify_overdue",
                "source": "identity_verification",
                "target": "overdue_info",
                "label": "Verified",
                "type": "llm",
            },
            {
                "id": "e_overdue_check",
                "source": "overdue_info",
                "target": "payment_check",
                "label": "Acknowledged",
                "type": "llm",
            },
            {
                "id": "e_check_paid",
                "source": "payment_check",
                "target": "payment_amount",
                "label": "Payment made",
                "type": "llm",
            },
            {
                "id": "e_check_notpaid",
                "source": "payment_check",
                "target": "commitment_request",
                "label": "Not paid",
                "type": "llm",
            },
            {
                "id": "e_amount_receipt",
                "source": "payment_amount",
                "target": "receipt_check",
                "label": "Amount captured",
                "type": "llm",
            },
            {
                "id": "e_receipt_thank",
                "source": "receipt_check",
                "target": "thank_payment",
                "label": "Receipt noted",
                "type": "llm",
            },
            {
                "id": "e_thank_farewell",
                "source": "thank_payment",
                "target": "farewell",
                "label": "Done",
                "type": "llm",
            },
            {
                "id": "e_commitment_options",
                "source": "commitment_request",
                "target": "payment_options",
                "label": "Date committed",
                "type": "llm",
            },
            {
                "id": "e_options_farewell",
                "source": "payment_options",
                "target": "farewell",
                "label": "Options provided",
                "type": "llm",
            },
        ],
    },

    # ─────────────────── FLOW 2: Standard with Objection Handling ────────────────────
    "flow_standard": {
        "id": "flow_standard",
        "name": "Standard with Objection Handling",
        "description": "Standard flow with objection handling for DPD 8-30 days (Tier 2 customers).",
        "tier": "tier_2",
        "nodes": [
            {
                "id": "greeting",
                "label": "Greeting",
                "type": "start",
                "description": "Warm greeting and self-introduction.",
                "system_prompt_snippet": (
                    "Greet warmly in Hinglish: 'Namaste {customer_name} ji! Main [Company] loan "
                    "department se [Agent Name] bol raha/rahi hoon. Aapse kuch important baat karni thi.'"
                ),
                "position": {"x": 400, "y": 50},
            },
            {
                "id": "identity_verification",
                "label": "Identity Verification",
                "type": "action",
                "description": "Verify identity via loan ID last 4 digits or DOB.",
                "system_prompt_snippet": (
                    "Verify: 'Security ke liye, kya aap apne loan account ke last 4 digits confirm kar sakte hain?' "
                    "Wait for confirmation."
                ),
                "position": {"x": 400, "y": 170},
            },
            {
                "id": "overdue_info",
                "label": "Overdue Information",
                "type": "action",
                "description": "Share overdue amount and urgency.",
                "system_prompt_snippet": (
                    "Inform: 'Aapka Rs.{outstanding_amount} ki EMI {dpd} din se pending hai. "
                    "Yeh aapke CIBIL score ko affect kar sakta hai. Hum aapko help karna chahte hain.'"
                ),
                "position": {"x": 400, "y": 290},
            },
            {
                "id": "listen_situation",
                "label": "Listen to Situation",
                "type": "decision",
                "description": "Listen and categorize customer's response.",
                "system_prompt_snippet": (
                    "Ask empathetically: 'Kya aap mujhe batayenge kyon payment mein delay hua? "
                    "Hum aapki madad karna chahte hain.' Listen carefully — route to payment_made, "
                    "objection, or no_answer branch."
                ),
                "position": {"x": 400, "y": 410},
            },
            {
                "id": "payment_amount",
                "label": "Capture Payment",
                "type": "action",
                "description": "Capture payment details.",
                "system_prompt_snippet": (
                    "Say: 'Excellent! Kab aur kitna payment kiya? UTR ya receipt number hai kya?' "
                    "Record all payment details."
                ),
                "position": {"x": 80, "y": 530},
            },
            {
                "id": "receipt_check",
                "label": "Receipt Check",
                "type": "action",
                "description": "Confirm payment receipt.",
                "system_prompt_snippet": (
                    "Confirm: 'Hum 24 ghante mein verify kar lenge. Aapka case close kar dete hain.' "
                ),
                "position": {"x": 80, "y": 650},
            },
            {
                "id": "thank_payment",
                "label": "Thank for Payment",
                "type": "action",
                "description": "Thank customer and confirm closure.",
                "system_prompt_snippet": (
                    "'Bahut bahut shukriya! Aapka account jald update hoga. Koi help chahiye?' "
                ),
                "position": {"x": 80, "y": 770},
            },
            {
                "id": "handle_objection",
                "label": "Handle Objection",
                "type": "action",
                "description": "Address customer's objection empathetically.",
                "system_prompt_snippet": (
                    "Acknowledge: 'Main samajhta/samajhti hoon aapki situation. Yeh mushkil time hai. "
                    "Par late payment se aur bhi problem ho sakti hai. Aiye saath mein solution dhundhte hain.'"
                ),
                "position": {"x": 400, "y": 530},
            },
            {
                "id": "offer_solutions",
                "label": "Offer Solutions",
                "type": "action",
                "description": "Offer EMI restructuring or partial payment options.",
                "system_prompt_snippet": (
                    "Offer: 'Kya aap partial payment kar sakte hain — jaise Rs.{partial_amount}? "
                    "Ya hum EMI ko restructure kar sakte hain. Kya option aapke liye better hai?' "
                    "Press 1 for partial payment, 2 for restructure, 3 for callback."
                ),
                "position": {"x": 400, "y": 650},
            },
            {
                "id": "get_commitment",
                "label": "Get Commitment",
                "type": "dtmf",
                "description": "Capture payment commitment date via DTMF or voice.",
                "system_prompt_snippet": (
                    "Ask: 'Kab tak payment kar payenge? Ek specific date bataiye.' "
                    "Record commitment date and amount."
                ),
                "position": {"x": 400, "y": 770},
            },
            {
                "id": "payment_options",
                "label": "Payment Options",
                "type": "action",
                "description": "Provide payment methods.",
                "system_prompt_snippet": (
                    "Provide UPI, NEFT, and branch payment options. "
                    "Confirm the committed date and amount."
                ),
                "position": {"x": 400, "y": 890},
            },
            {
                "id": "callback_request",
                "label": "Callback Request",
                "type": "action",
                "description": "Schedule a callback when customer is unavailable.",
                "system_prompt_snippet": (
                    "Say: 'Koi baat nahi. Kab call karun aapko? Subah 10 baje ya shaam 5 baje?' "
                    "Record preferred callback time."
                ),
                "position": {"x": 720, "y": 530},
            },
            {
                "id": "farewell",
                "label": "Farewell",
                "type": "end",
                "description": "Professional farewell.",
                "system_prompt_snippet": (
                    "'Shukriya aapke samay ke liye {customer_name} ji. Hum jald touch mein rahenge. "
                    "Helpline: {helpline_number}. Dhanyawad!'"
                ),
                "position": {"x": 400, "y": 1010},
            },
        ],
        "edges": [
            {"id": "e1", "source": "greeting", "target": "identity_verification", "label": "Responds", "type": "llm"},
            {"id": "e2", "source": "identity_verification", "target": "overdue_info", "label": "Verified", "type": "llm"},
            {"id": "e3", "source": "overdue_info", "target": "listen_situation", "label": "Acknowledged", "type": "llm"},
            {"id": "e4", "source": "listen_situation", "target": "payment_amount", "label": "Payment made", "type": "llm"},
            {"id": "e5", "source": "listen_situation", "target": "handle_objection", "label": "Has objection", "type": "llm"},
            {"id": "e6", "source": "listen_situation", "target": "callback_request", "label": "Not available", "type": "llm"},
            {"id": "e7", "source": "payment_amount", "target": "receipt_check", "label": "Amount captured", "type": "llm"},
            {"id": "e8", "source": "receipt_check", "target": "thank_payment", "label": "Confirmed", "type": "llm"},
            {"id": "e9", "source": "thank_payment", "target": "farewell", "label": "Done", "type": "llm"},
            {"id": "e10", "source": "handle_objection", "target": "offer_solutions", "label": "Acknowledged", "type": "llm"},
            {"id": "e11", "source": "offer_solutions", "target": "get_commitment", "label": "Option chosen", "type": "dtmf"},
            {"id": "e12", "source": "get_commitment", "target": "payment_options", "label": "Date given", "type": "llm"},
            {"id": "e13", "source": "payment_options", "target": "farewell", "label": "Provided", "type": "llm"},
            {"id": "e14", "source": "callback_request", "target": "farewell", "label": "Scheduled", "type": "llm"},
        ],
    },

    # ────────────────────── FLOW 3: Advanced Negotiation ─────────────────────────────
    "flow_advanced": {
        "id": "flow_advanced",
        "name": "Advanced Negotiation",
        "description": "Full negotiation flow with settlement options for DPD 30+ days (Tier 3 customers).",
        "tier": "tier_3",
        "nodes": [
            {
                "id": "greeting",
                "label": "Greeting",
                "type": "start",
                "description": "Professional and empathetic opening.",
                "system_prompt_snippet": (
                    "'Namaste {customer_name} ji. Main [Company] ke loan recovery team se [Agent] hoon. "
                    "Aapke account ke baare mein kuch urgent matter discuss karna tha. Kya abhi baat ho sakti hai?'"
                ),
                "position": {"x": 500, "y": 50},
            },
            {
                "id": "identity_verification",
                "label": "Identity Verification",
                "type": "action",
                "description": "Strong identity verification.",
                "system_prompt_snippet": (
                    "Verify identity strictly: 'Security ke liye aapka DOB aur registered mobile number confirm karein.'"
                ),
                "position": {"x": 500, "y": 170},
            },
            {
                "id": "account_review",
                "label": "Account Review",
                "type": "action",
                "description": "Share complete account status including legal implications.",
                "system_prompt_snippet": (
                    "'Aapka account {dpd} din se overdue hai. Rs.{outstanding_amount} pending hai. "
                    "Agar 7 din mein resolution na ho toh legal notice process shuru ho sakti hai. "
                    "Main chahta/chahti hoon yeh naubat na aaye.'"
                ),
                "position": {"x": 500, "y": 290},
            },
            {
                "id": "assess_situation",
                "label": "Assess Situation",
                "type": "decision",
                "description": "Deep-dive into customer's financial situation.",
                "system_prompt_snippet": (
                    "'Kya aap mujhe apni situation explain kar sakte hain? Job loss, medical emergency, "
                    "ya koi aur problem?' Listen carefully. Route based on response: payment_made, "
                    "simple_objection, or complex_objection."
                ),
                "position": {"x": 500, "y": 410},
            },
            {
                "id": "payment_amount",
                "label": "Capture Payment",
                "type": "action",
                "description": "Record payment details.",
                "system_prompt_snippet": (
                    "Record full payment details: amount, date, UTR, payment method."
                ),
                "position": {"x": 150, "y": 530},
            },
            {
                "id": "receipt_check",
                "label": "Receipt Verification",
                "type": "action",
                "description": "Verify receipt and confirm case closure.",
                "system_prompt_snippet": (
                    "'UTR number note kar liya. 24 ghante mein update hoga. Aapka NOC bhi issue karenge.'"
                ),
                "position": {"x": 150, "y": 650},
            },
            {
                "id": "thank_payment",
                "label": "Thank & Close",
                "type": "action",
                "description": "Thank customer and close case.",
                "system_prompt_snippet": (
                    "'Bahut shukriya! Aapka account clear mark ho jayega. NOC 7 working days mein milega.'"
                ),
                "position": {"x": 150, "y": 770},
            },
            {
                "id": "handle_objection",
                "label": "Handle Objection",
                "type": "action",
                "description": "Address simple objections (temporary cash flow issue).",
                "system_prompt_snippet": (
                    "Empathize deeply: 'Main poori tarah samajhta/samajhti hoon. "
                    "Iss mushkil mein hum aapke saath hain. Aiye koi middle ground dhundhte hain.'"
                ),
                "position": {"x": 500, "y": 530},
            },
            {
                "id": "offer_solutions",
                "label": "Offer Flexible Solutions",
                "type": "action",
                "description": "Offer EMI restructuring, moratorium, or partial payment.",
                "system_prompt_snippet": (
                    "Present options: '1. Sirf Rs.{minimum_amount} abhi pay karein, baaki next month. "
                    "2. EMI ko 3 month ke liye restructure karein. "
                    "3. Ek baar mein full payment pe 5% waiver. Konsa option chahiye?'"
                ),
                "position": {"x": 500, "y": 650},
            },
            {
                "id": "get_commitment",
                "label": "Get Firm Commitment",
                "type": "action",
                "description": "Secure commitment with specific amount and date.",
                "system_prompt_snippet": (
                    "'Toh aap {commitment_amount} ka payment {commitment_date} tak karenge — is par hum "
                    "agreement karte hain. Main iska note kar leta/leti hoon. Confirm kijiye.'"
                ),
                "position": {"x": 500, "y": 770},
            },
            {
                "id": "settlement_options",
                "label": "Settlement Options",
                "type": "action",
                "description": "Present one-time settlement offer for severe cases.",
                "system_prompt_snippet": (
                    "'Aapki situation dekh ke hum ek special one-time settlement offer de sakte hain: "
                    "Rs.{settlement_amount} mein poora account clear. Yeh offer sirf {offer_days} din tak valid hai. "
                    "Press 1 to accept, 2 for more options.'"
                ),
                "position": {"x": 850, "y": 530},
            },
            {
                "id": "negotiation",
                "label": "Negotiation",
                "type": "dtmf",
                "description": "Active negotiation on settlement terms.",
                "system_prompt_snippet": (
                    "Negotiate: 'Aap kitna ek baar mein de sakte hain? Minimum Rs.{minimum_settlement} se "
                    "start karte hain. Baaki installments mein arrange karenge.' Listen and counter-offer."
                ),
                "position": {"x": 850, "y": 650},
            },
            {
                "id": "documentation",
                "label": "Documentation",
                "type": "action",
                "description": "Capture settlement agreement details.",
                "system_prompt_snippet": (
                    "'Agreement terms note kar raha/rahi hoon: Amount {settlement_amount}, "
                    "Payment date {payment_date}. Aapko SMS/email par confirmation milegi.'"
                ),
                "position": {"x": 720, "y": 770},
            },
            {
                "id": "escalation",
                "label": "Escalation",
                "type": "action",
                "description": "Escalate to senior manager or legal team.",
                "system_prompt_snippet": (
                    "'Aapke case ko main senior manager ko transfer kar raha/rahi hoon. "
                    "Woh aapko 2 ghante mein call karenge. Ek last chance hai amicable resolution ka.'"
                ),
                "position": {"x": 980, "y": 770},
            },
            {
                "id": "farewell",
                "label": "Farewell",
                "type": "end",
                "description": "Close call with next steps.",
                "system_prompt_snippet": (
                    "'Dhanyawad {customer_name} ji. Agreed terms ki SMS confirmation aayegi. "
                    "Koi bhi query ke liye {helpline_number} pe call karein. Dhanyawad!'"
                ),
                "position": {"x": 500, "y": 890},
            },
        ],
        "edges": [
            {"id": "e1", "source": "greeting", "target": "identity_verification", "label": "Responds", "type": "llm"},
            {"id": "e2", "source": "identity_verification", "target": "account_review", "label": "Verified", "type": "llm"},
            {"id": "e3", "source": "account_review", "target": "assess_situation", "label": "Acknowledged", "type": "llm"},
            {"id": "e4", "source": "assess_situation", "target": "payment_amount", "label": "Payment made", "type": "llm"},
            {"id": "e5", "source": "assess_situation", "target": "handle_objection", "label": "Simple objection", "type": "llm"},
            {"id": "e6", "source": "assess_situation", "target": "settlement_options", "label": "Complex/severe case", "type": "llm"},
            {"id": "e7", "source": "payment_amount", "target": "receipt_check", "label": "Captured", "type": "llm"},
            {"id": "e8", "source": "receipt_check", "target": "thank_payment", "label": "Confirmed", "type": "llm"},
            {"id": "e9", "source": "thank_payment", "target": "farewell", "label": "Done", "type": "llm"},
            {"id": "e10", "source": "handle_objection", "target": "offer_solutions", "label": "Understood", "type": "llm"},
            {"id": "e11", "source": "offer_solutions", "target": "get_commitment", "label": "Option selected", "type": "llm"},
            {"id": "e12", "source": "get_commitment", "target": "farewell", "label": "Committed", "type": "llm"},
            {"id": "e13", "source": "settlement_options", "target": "negotiation", "label": "Interested", "type": "dtmf"},
            {"id": "e14", "source": "negotiation", "target": "documentation", "label": "Accepted (DTMF 1)", "type": "dtmf"},
            {"id": "e15", "source": "negotiation", "target": "escalation", "label": "Rejected (DTMF 2)", "type": "dtmf"},
            {"id": "e16", "source": "documentation", "target": "farewell", "label": "Documented", "type": "llm"},
            {"id": "e17", "source": "escalation", "target": "farewell", "label": "Escalated", "type": "llm"},
        ],
    },
}
