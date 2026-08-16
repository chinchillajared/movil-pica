DEFAULT_HOMEPAGE_CONTENT = {
    "hero": {
        "es": {
            "kicker": "Servicio automotriz sin complicaciones",
            "title": "Tu vehículo,",
            "emphasis": "en buenas manos.",
            "copy": "Diagnóstico, mantenimiento y reparaciones con atención clara, técnicos preparados y la comodidad de agendar en línea.",
            "primary_cta": "Agendar una cita",
            "secondary_cta": "Ver servicios rápidos",
            "trust_1": "Horarios disponibles en línea",
            "trust_2": "Atención personalizada",
            "feature_kicker": "Atención que se entiende",
            "feature_title": "Primero revisamos. Luego te explicamos.",
            "feature_copy": "Recibe información de tu vehículo y un proceso transparente desde la primera conversación.",
        },
        "en": {
            "kicker": "Automotive service without the hassle",
            "title": "Your vehicle,",
            "emphasis": "in good hands.",
            "copy": "Clear diagnostics, skilled technicians and the convenience of booking online for maintenance and repairs.",
            "primary_cta": "Book an appointment",
            "secondary_cta": "View quick services",
            "trust_1": "Online availability",
            "trust_2": "Personal attention",
            "feature_kicker": "Service you can understand",
            "feature_title": "We inspect first. Then we explain.",
            "feature_copy": "Get clear information about your vehicle and a transparent process from the first conversation.",
        },
    },
    "services": {
        "es": {
            "kicker": "Mantenimiento esencial",
            "title": "Algunos servicios",
            "copy": "Soluciones frecuentes para mantener tu vehículo seguro, confiable y listo para seguir.",
        },
        "en": {
            "kicker": "Essential maintenance",
            "title": "Some services",
            "copy": "Common solutions to keep your vehicle safe, reliable and ready for the road.",
        },
        "cards": [
            {"es": {"title": "Cambio de aceite", "copy": "Aceite de motor y filtro para proteger el rendimiento diario."}, "en": {"title": "Oil change", "copy": "Engine oil and filter service to protect everyday performance."}},
            {"es": {"title": "Sistema de frenos", "copy": "Revisión y reemplazo de pastillas para frenar con confianza."}, "en": {"title": "Brake system", "copy": "Brake pad inspection and replacement for confident stops."}},
            {"es": {"title": "Afinamiento", "copy": "Una revisión de puntos clave para mejorar respuesta y consumo."}, "en": {"title": "Tune-up", "copy": "A focused check of key systems to improve response and fuel economy."}},
            {"es": {"title": "Diagnóstico general", "copy": "Identificamos el problema antes de cambiar piezas o tomar decisiones."}, "en": {"title": "General diagnostics", "copy": "We identify the issue before changing parts or making decisions."}},
        ],
    },
    "process": {
        "es": {
            "kicker": "Un proceso simple",
            "title": "Agenda sin llamadas interminables",
            "steps": [
                {"title": "Elige el día", "copy": "Consulta el calendario y selecciona una fecha disponible."},
                {"title": "Reserva tu hora", "copy": "Te mostramos únicamente los horarios que siguen libres."},
                {"title": "Confirma tus datos", "copy": "Indica tu vehículo y ubicación. Nosotros nos encargamos del resto."},
            ],
        },
        "en": {
            "kicker": "A simple process",
            "title": "Book without endless calls",
            "steps": [
                {"title": "Choose a day", "copy": "Check the calendar and select an available date."},
                {"title": "Reserve your time", "copy": "We only show time slots that are still available."},
                {"title": "Confirm your details", "copy": "Tell us about your vehicle and location. We will handle the rest."},
            ],
        },
    },
    "cta": {
        "es": {"title": "¿Tu vehículo necesita atención?", "copy": "Reserva un espacio y recibe acompañamiento claro desde el primer paso.", "button": "Agendar una cita"},
        "en": {"title": "Does your vehicle need attention?", "copy": "Reserve a spot and get clear support from the very first step.", "button": "Book an appointment"},
    },
}


DEFAULT_HOMEPAGE_LAYOUT = {
    "section_order": ["hero", "services", "process", "cta"],
    "section_visibility": {"hero": True, "services": True, "process": True, "cta": True},
    "image_indices": {"hero": 0, "services": [0, 1, 2, 3]},
    "sizes": {
        "hero_min_height": 560,
        "section_padding": 96,
        "service_card_image_height": 180,
        "cta_padding": 32,
    },
}
