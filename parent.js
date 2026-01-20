/* Enhanced Progress Report Tab Styles */

/* Gradient backgrounds */
.gradient-bg-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.gradient-bg-success {
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
}

.gradient-bg-info {
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
}

.gradient-bg-warning {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
}

/* Animations */
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideIn {
    from {
        transform: translateX(-20px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes pulse-glow {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
    }
    50% {
        box-shadow: 0 0 0 10px rgba(74, 222, 128, 0);
    }
}

@keyframes shimmer {
    0% {
        background-position: -200px 0;
    }
    100% {
        background-position: calc(200px + 100%) 0;
    }
}

/* Interactive Elements */
.interactive-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.interactive-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Status Indicators */
.status-indicator {
    position: relative;
}

.status-indicator::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #10b981;
    border: 2px solid white;
    animation: pulse 2s infinite;
}

.status-indicator.inactive::after {
    background-color: #6b7280;
    animation: none;
}

/* Progress Bars */
.progress-bar-container {
    position: relative;
    overflow: hidden;
    background-color: #e5e7eb;
}

.progress-bar-fill {
    height: 100%;
    transition: width 0.6s ease;
    position: relative;
    overflow: hidden;
}

.progress-bar-fill::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    background-image: linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.2) 25%,
        transparent 25%,
        transparent 50%,
        rgba(255, 255, 255, 0.2) 50%,
        rgba(255, 255, 255, 0.2) 75%,
        transparent 75%,
        transparent
    );
    background-size: 20px 20px;
    animation: shimmer 2s infinite linear;
}

/* Accordion Transitions */
.accordion-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
}

.accordion-content.expanded {
    max-height: 1000px;
}

/* Loading States */
.skeleton-loader {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
}

/* Badge Variations */
.badge-gradient {
    background: linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to));
    color: white;
    border: none;
}

.badge-pulse {
    animation: pulse 2s infinite;
}

/* Card Hover Effects */
.hover-lift {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Responsive Grid Adjustments */
@media (max-width: 640px) {
    .mobile-stack {
        flex-direction: column;
    }
    
    .mobile-full-width {
        width: 100%;
    }
}

/* Print Styles for Reports */
@media print {
    .no-print {
        display: none !important;
    }
    
    .print-only {
        display: block !important;
    }
    
    .break-inside-avoid {
        break-inside: avoid;
    }
}

/* Accessibility */
.focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
}

/* Dark mode support (optional) */
@media (prefers-color-scheme: dark) {
    .dark\:gradient-bg-dark {
        background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    }
}
