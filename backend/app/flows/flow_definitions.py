"""
Pipecat-style conversation flow definitions for the loan collection AI agent.
Each flow is a directed graph with nodes (steps) and edges (transitions).
Node positions are ReactFlow-compatible.

All example phrases in system_prompt_snippets are written in Devanagari script
so that the LLM learns to mirror the same format in its responses, which are
then sent to the Sarvam bulbul:v3 TTS. Roman transliteration of Hindi causes
the TTS to mispronounce words (e.g. 'main' is read as English 'main').
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
                    "Greet the customer warmly. Say: 'नमस्ते! मैं [Company] से बोल रही हूँ। "
                    "क्या आप {customer_name}जी बोल रहे हैं?' Wait for confirmation before proceeding."
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
                    "or their date of birth to verify identity. Do not proceed without verification. "
                    "Say: 'Security के लिए, क्या आप अपने loan account के last 4 digits confirm कर सकते हैं?'"
                ),
                "position": {"x": 250, "y": 170},
            },
            {
                "id": "overdue_info",
                "label": "Overdue Information",
                "type": "action",
                "description": "Inform customer about the overdue EMI amount and due date.",
                "system_prompt_snippet": (
                    "Politely inform: 'आपके loan account में Rs.{outstanding_amount} बकाया है जो "
                    "{dpd} दिन से overdue है। due date थी {due_date}।' Be factual and empathetic."
                ),
                "position": {"x": 250, "y": 290},
            },
            {
                "id": "payment_check",
                "label": "Payment Check",
                "type": "decision",
                "description": "Ask if the customer has already made the payment.",
                "system_prompt_snippet": (
                    "Ask: 'क्या आपने इस amount का payment कर दिया है?' "
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
                    "Ask: 'कितना payment किया? और कब किया?' Record the amount and date. "
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
                    "Ask: 'क्या आपके पास payment का receipt या UTR number है?' "
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
                    "Say: 'बहुत शुक्रिया payment के लिए! आपका account 24 घंटे में update हो जाएगा। "
                    "कोई और help चाहिए?' Proceed to farewell."
                ),
                "position": {"x": 80, "y": 770},
            },
            {
                "id": "commitment_request",
                "label": "Commitment Request",
                "type": "action",
                "description": "Request payment commitment with a specific date.",
                "system_prompt_snippet": (
                    "Say: 'क्या आप आज या कल payment कर सकते हैं? Rs.{outstanding_amount} clear करना "
                    "credit score के लिए बहुत ज़रूरी है।' Ask for a commitment date."
                ),
                "position": {"x": 420, "y": 530},
            },
            {
                "id": "payment_options",
                "label": "Payment Options",
                "type": "action",
                "description": "Provide payment methods: UPI, NEFT, branch.",
                "system_prompt_snippet": (
                    "Provide options: 'आप UPI से {upi_id} पर, या NEFT से account {account_number} में, "
                    "या nearest branch में payment कर सकते हैं।' Ask if they need any other help."
                ),
                "position": {"x": 420, "y": 650},
            },
            {
                "id": "farewell",
                "label": "Farewell",
                "type": "end",
                "description": "Polite farewell and call wrap-up.",
                "system_prompt_snippet": (
                    "Say: 'धन्यवाद आपके समय के लिए। कोई भी problem हो तो हमारा helpline "
                    "{helpline_number} पर call करें। आपका दिन शुभ हो!' End the call."
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
                    "Greet warmly: 'नमस्ते {customer_name}जी! मैं [Company] loan department से "
                    "बोल रही हूँ। आपसे कुछ important बात करनी थी।'"
                ),
                "position": {"x": 400, "y": 50},
            },
            {
                "id": "identity_verification",
                "label": "Identity Verification",
                "type": "action",
                "description": "Verify identity via loan ID last 4 digits or DOB.",
                "system_prompt_snippet": (
                    "Verify: 'Security के लिए, क्या आप अपने loan account के last 4 digits confirm "
                    "कर सकते हैं?' Wait for confirmation."
                ),
                "position": {"x": 400, "y": 170},
            },
            {
                "id": "overdue_info",
                "label": "Overdue Information",
                "type": "action",
                "description": "Share overdue amount and urgency.",
                "system_prompt_snippet": (
                    "Inform: 'आपकी Rs.{outstanding_amount} की EMI {dpd} दिन से pending है। "
                    "यह आपके CIBIL score को affect कर सकता है। हम आपकी help करना चाहते हैं।'"
                ),
                "position": {"x": 400, "y": 290},
            },
            {
                "id": "listen_situation",
                "label": "Listen to Situation",
                "type": "decision",
                "description": "Listen and categorize customer's response.",
                "system_prompt_snippet": (
                    "Ask empathetically: 'क्या आप मुझे बताएंगे क्यों payment में delay हुई? "
                    "हम आपकी मदद करना चाहते हैं।' Listen carefully — route to payment_made, "
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
                    "Say: 'Excellent! कब और कितना payment किया? UTR या receipt number है क्या?' "
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
                    "Confirm: 'हम 24 घंटे में verify कर लेंगे। आपका case close कर देते हैं।'"
                ),
                "position": {"x": 80, "y": 650},
            },
            {
                "id": "thank_payment",
                "label": "Thank for Payment",
                "type": "action",
                "description": "Thank customer and confirm closure.",
                "system_prompt_snippet": (
                    "'बहुत बहुत शुक्रिया! आपका account जल्द update होगा। कोई help चाहिए?'"
                ),
                "position": {"x": 80, "y": 770},
            },
            {
                "id": "handle_objection",
                "label": "Handle Objection",
                "type": "action",
                "description": "Address customer's objection empathetically.",
                "system_prompt_snippet": (
                    "Acknowledge: 'मैं समझती हूँ आपकी situation। यह मुश्किल time है। "
                    "पर late payment से और भी problem हो सकती है। आइए साथ मिलकर solution ढूंढते हैं।'"
                ),
                "position": {"x": 400, "y": 530},
            },
            {
                "id": "offer_solutions",
                "label": "Offer Solutions",
                "type": "action",
                "description": "Offer EMI restructuring or partial payment options.",
                "system_prompt_snippet": (
                    "Offer: 'क्या आप partial payment कर सकते हैं — जैसे Rs.{partial_amount}? "
                    "या हम EMI को restructure कर सकते हैं। कौन सा option आपके लिए बेहतर है?' "
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
                    "Ask: 'कब तक payment कर पाएंगे? एक specific date बताइए।' "
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
                    "Say: 'कोई बात नहीं। कब call करूँ आपको? सुबह 10 बजे या शाम 5 बजे?' "
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
                    "'शुक्रिया आपके समय के लिए {customer_name}जी। हम जल्द touch में रहेंगे। "
                    "Helpline: {helpline_number}। धन्यवाद!'"
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
                    "'नमस्ते {customer_name}जी। मैं [Company] की loan recovery team से बोल रही हूँ। "
                    "आपके account के बारे में कुछ urgent matter discuss करना था। क्या अभी बात हो सकती है?'"
                ),
                "position": {"x": 500, "y": 50},
            },
            {
                "id": "identity_verification",
                "label": "Identity Verification",
                "type": "action",
                "description": "Strong identity verification.",
                "system_prompt_snippet": (
                    "Verify identity strictly: 'Security के लिए आपका DOB और registered mobile number confirm करें।'"
                ),
                "position": {"x": 500, "y": 170},
            },
            {
                "id": "account_review",
                "label": "Account Review",
                "type": "action",
                "description": "Share complete account status including legal implications.",
                "system_prompt_snippet": (
                    "'आपका account {dpd} दिन से overdue है। Rs.{outstanding_amount} pending है। "
                    "अगर 7 दिन में resolution न हो तो legal notice process शुरू हो सकती है। "
                    "मैं चाहती हूँ यह नौबत न आए।'"
                ),
                "position": {"x": 500, "y": 290},
            },
            {
                "id": "assess_situation",
                "label": "Assess Situation",
                "type": "decision",
                "description": "Deep-dive into customer's financial situation.",
                "system_prompt_snippet": (
                    "'क्या आप मुझे अपनी situation explain कर सकते हैं? Job loss, medical emergency, "
                    "या कोई और problem?' Listen carefully. Route based on response: payment_made, "
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
                    "'UTR number note कर लिया। 24 घंटे में update होगा। आपका NOC भी issue करेंगे।'"
                ),
                "position": {"x": 150, "y": 650},
            },
            {
                "id": "thank_payment",
                "label": "Thank & Close",
                "type": "action",
                "description": "Thank customer and close case.",
                "system_prompt_snippet": (
                    "'बहुत शुक्रिया! आपका account clear mark हो जाएगा। NOC 7 working days में मिलेगा।'"
                ),
                "position": {"x": 150, "y": 770},
            },
            {
                "id": "handle_objection",
                "label": "Handle Objection",
                "type": "action",
                "description": "Address simple objections (temporary cash flow issue).",
                "system_prompt_snippet": (
                    "Empathize deeply: 'मैं पूरी तरह समझती हूँ। "
                    "इस मुश्किल में हम आपके साथ हैं। आइए कोई middle ground ढूंढते हैं।'"
                ),
                "position": {"x": 500, "y": 530},
            },
            {
                "id": "offer_solutions",
                "label": "Offer Flexible Solutions",
                "type": "action",
                "description": "Offer EMI restructuring, moratorium, or partial payment.",
                "system_prompt_snippet": (
                    "Present options: '1. सिर्फ Rs.{minimum_amount} अभी pay करें, बाकी next month। "
                    "2. EMI को 3 month के लिए restructure करें। "
                    "3. एक बार में full payment पर 5% waiver। कौन सा option चाहिए?'"
                ),
                "position": {"x": 500, "y": 650},
            },
            {
                "id": "get_commitment",
                "label": "Get Firm Commitment",
                "type": "action",
                "description": "Secure commitment with specific amount and date.",
                "system_prompt_snippet": (
                    "'तो आप {commitment_amount} का payment {commitment_date} तक करेंगे — इस पर हम "
                    "agreement करते हैं। मैं इसे note कर लेती हूँ। confirm कीजिए।'"
                ),
                "position": {"x": 500, "y": 770},
            },
            {
                "id": "settlement_options",
                "label": "Settlement Options",
                "type": "action",
                "description": "Present one-time settlement offer for severe cases.",
                "system_prompt_snippet": (
                    "'आपकी situation देख कर हम एक special one-time settlement offer दे सकते हैं: "
                    "Rs.{settlement_amount} में पूरा account clear। यह offer सिर्फ {offer_days} दिन तक valid है। "
                    "accept के लिए 1 दबाएं, अधिक options के लिए 2।'"
                ),
                "position": {"x": 850, "y": 530},
            },
            {
                "id": "negotiation",
                "label": "Negotiation",
                "type": "dtmf",
                "description": "Active negotiation on settlement terms.",
                "system_prompt_snippet": (
                    "Negotiate: 'आप कितना एक बार में दे सकते हैं? Minimum Rs.{minimum_settlement} से "
                    "start करते हैं। बाकी installments में arrange करेंगे।' Listen and counter-offer."
                ),
                "position": {"x": 850, "y": 650},
            },
            {
                "id": "documentation",
                "label": "Documentation",
                "type": "action",
                "description": "Capture settlement agreement details.",
                "system_prompt_snippet": (
                    "'Agreement terms note कर रही हूँ: Amount {settlement_amount}, "
                    "Payment date {payment_date}। आपको SMS/email पर confirmation मिलेगी।'"
                ),
                "position": {"x": 720, "y": 770},
            },
            {
                "id": "escalation",
                "label": "Escalation",
                "type": "action",
                "description": "Escalate to senior manager or legal team.",
                "system_prompt_snippet": (
                    "'आपके case को मैं senior manager को transfer कर रही हूँ। "
                    "वो आपको 2 घंटे में call करेंगे। यह amicable resolution का last chance है।'"
                ),
                "position": {"x": 980, "y": 770},
            },
            {
                "id": "farewell",
                "label": "Farewell",
                "type": "end",
                "description": "Close call with next steps.",
                "system_prompt_snippet": (
                    "'धन्यवाद {customer_name}जी। agreed terms की SMS confirmation आएगी। "
                    "कोई भी query के लिए {helpline_number} पर call करें। धन्यवाद!'"
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
    "flow_field_visit": {
        "id": "flow_field_visit",
        "name": "Field Visit",
        "description": "Verify field agent visit and payment collection",
        "tier": "tier_0",
        "nodes": [
            {
                "id": "greeting",
                "label": "Greeting",
                "type": "start",
                "description": "Introduce call purpose",
                "system_prompt_snippet": (
                    "Greet the customer warmly. Say: 'Hello {customer_name}ji, this is an automated "
                    "call to confirm a recent visit related to your account. I hope you are doing well.'"
                ),
                "position": {"x": 250, "y": 0},
            },
            {
                "id": "visit_check",
                "label": "Visit Check",
                "type": "decision",
                "description": "Did employee make a field visit?",
                "system_prompt_snippet": (
                    "Ask: 'Did {employee_name} make a field visit to you recently? Please say Yes or No.' "
                    "If customer says Yes, proceed to payment_check. "
                    "If customer says No, proceed to visit_no_end."
                ),
                "position": {"x": 250, "y": 140},
            },
            {
                "id": "visit_no_end",
                "label": "No Visit",
                "type": "end",
                "description": "Customer confirms no visit was made",
                "system_prompt_snippet": (
                    "The customer said no visit was made. Say: 'Thank you for confirming. "
                    "We will update our records accordingly. If you have any queries please contact us. "
                    "Have a good day. Goodbye.' Then end the call."
                ),
                "position": {"x": 0, "y": 290},
            },
            {
                "id": "payment_check",
                "label": "Payment Check",
                "type": "decision",
                "description": "Was payment made during/after the visit?",
                "system_prompt_snippet": (
                    "The customer confirmed the visit. Ask: 'Thank you. Did you make any payment "
                    "during or after the visit? Please say Yes or No.'"
                    "If Yes, proceed to payment_amount. If No, proceed to payment_no_end."
                ),
                "position": {"x": 500, "y": 290},
            },
            {
                "id": "payment_no_end",
                "label": "No Payment",
                "type": "end",
                "description": "Customer confirms no payment was made",
                "system_prompt_snippet": (
                    "The customer said no payment was made during the visit. Say: "
                    "'Thank you for the information. We have updated our records. "
                    "If you have any queries please contact us. Have a good day. Goodbye.' "
                    "Then end the call."
                ),
                "position": {"x": 300, "y": 440},
            },
            {
                "id": "payment_amount",
                "label": "Payment Amount",
                "type": "action",
                "description": "Capture how much was paid",
                "system_prompt_snippet": (
                    "The customer made a payment. Ask: 'Thank you. How much payment did you make? "
                    "Please tell me the exact amount.' Listen carefully and record the amount "
                    "as payment_amount in the context. Repeat the amount back to confirm."
                ),
                "position": {"x": 700, "y": 440},
            },
            {
                "id": "end",
                "label": "Close Call",
                "type": "end",
                "description": "Confirm payment and close",
                "system_prompt_snippet": (
                    "Payment amount has been captured. Say: 'Thank you for confirming the payment. "
                    "We have recorded it and our team will verify and update your account within 24 hours. "
                    "Have a good day. Goodbye.' Then end the call."
                ),
                "position": {"x": 700, "y": 590},
            },
        ],
        "edges": [
            {"id": "e1", "source": "greeting", "target": "visit_check", "label": "Proceed", "type": "llm"},
            {"id": "e2", "source": "visit_check", "target": "visit_no_end", "label": "No visit", "type": "llm"},
            {"id": "e3", "source": "visit_check", "target": "payment_check", "label": "Visit done", "type": "llm"},
            {"id": "e4", "source": "payment_check", "target": "payment_no_end", "label": "No payment", "type": "llm"},
            {"id": "e5", "source": "payment_check", "target": "payment_amount", "label": "Payment made", "type": "llm"},
            {"id": "e6", "source": "payment_amount", "target": "end", "label": "Amount captured", "type": "llm"},
        ],
    },
}
