import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- Enhanced CSS for modern UI ---
const style = document.createElement('style');
style.textContent = `
    /* Modern UI Styles */
    :root {
        --primary-color: #10b981;
        --primary-dark: #059669;
        --primary-light: #d1fae5;
        --secondary-color: #6366f1;
        --danger-color: #ef4444;
        --warning-color: #f59e0b;
        --info-color: #3b82f6;
        --dark-color: #1f2937;
        --light-color: #f9fafb;
        --border-color: #e5e7eb;
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        --radius-sm: 0.375rem;
        --radius: 0.5rem;
        --radius-lg: 0.75rem;
        --success-color: #10b981;
    }

    /* Active Tab Styling */
    .nav-tab {
        padding: 0.75rem 1rem;
        border-radius: var(--radius);
        font-weight: 500;
        transition: all 0.2s ease;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--dark-color);
    }

    .nav-tab:hover {
        background-color: var(--light-color);
    }

    .nav-tab.active {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
        color: white;
        box-shadow: var(--shadow);
    }

    /* Enhanced Button Styles */
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.625rem 1.25rem;
        border-radius: var(--radius);
        font-weight: 500;
        font-size: 0.875rem;
        line-height: 1.25rem;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
        gap: 0.5rem;
    }

    .btn-primary {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
        color: white;
        box-shadow: var(--shadow);
    }

    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
    }

    .btn-secondary {
        background-color: white;
        color: var(--dark-color);
        border: 1px solid var(--border-color);
    }

    .btn-secondary:hover {
        background-color: var(--light-color);
    }

    .btn-danger {
        background-color: var(--danger-color);
        color: white;
    }

    .btn-warning {
        background-color: var(--warning-color);
        color: white;
    }

    .btn-info {
        background-color: var(--info-color);
        color: white;
    }

    .btn-sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
    }

    /* Card Styles */
    .card {
        background: white;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow);
        border: 1px solid var(--border-color);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
    }

    .card-header {
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid var(--border-color);
    }

    .card-body {
        padding: 1.5rem;
    }

    .card-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color);
        background-color: var(--light-color);
        border-bottom-left-radius: var(--radius-lg);
        border-bottom-right-radius: var(--radius-lg);
    }

    /* Badge Styles */
    .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1;
    }

    .badge-success {
        background-color: var(--primary-light);
        color: var(--primary-dark);
    }

    .badge-warning {
        background-color: #fef3c7;
        color: #92400e;
    }

    .badge-danger {
        background-color: #fee2e2;
        color: #991b1b;
    }

    .badge-info {
        background-color: #dbeafe;
        color: #1e40af;
    }

    .badge-secondary {
        background-color: #e5e7eb;
        color: #4b5563;
    }

    /* Table Styles */
    .table-container {
        overflow-x: auto;
        border-radius: var(--radius);
        box-shadow: var(--shadow-sm);
    }

    .table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
    }

    .table th {
        background-color: var(--light-color);
        padding: 1rem;
        font-weight: 600;
        text-align: left;
        color: var(--dark-color);
        border-bottom: 2px solid var(--border-color);
    }

    .table td {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        vertical-align: middle;
    }

    .table tr:hover {
        background-color: var(--light-color);
    }

    /* Form Styles - ENHANCED WIDTH */
    .form-group {
        margin-bottom: 1.25rem;
    }

    .form-label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--dark-color);
    }

    .form-input {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        font-size: 1rem;
    }

    .form-input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .form-textarea {
        min-height: 120px;
        resize: vertical;
        padding: 0.75rem 1rem;
        font-size: 1rem;
    }

    /* Modal Enhancements - WIDER MODALS */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
        padding: 1rem;
        animation: fadeIn 0.2s ease;
    }

    .modal-content {
        background: white;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        width: 100%;
        max-width: 48rem;
        max-height: 90vh;
        overflow-y: auto;
        animation: slideIn 0.3s ease;
    }

    .modal-header {
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .modal-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--dark-color);
    }

    .modal-body {
        padding: 1.5rem;
    }

    .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes slideIn {
        from { transform: translateY(-1rem); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    /* Loading Spinner */
    .spinner {
        animation: spin 1s linear infinite;
        width: 1.5rem;
        height: 1.5rem;
        border: 2px solid var(--border-color);
        border-top-color: var(--primary-color);
        border-radius: 50%;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Hero Section */
    .hero-section {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
        border-radius: var(--radius-lg);
        color: white;
        padding: 2rem;
        margin-bottom: 2rem;
    }

    .hero-title {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }

    .hero-subtitle {
        opacity: 0.9;
        font-size: 1.125rem;
    }

    /* Dashboard Grid */
    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    /* Status Indicators */
    .status-dot {
        display: inline-block;
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 50%;
        margin-right: 0.5rem;
    }

    .status-dot-success {
        background-color: var(--primary-color);
    }

    .status-dot-warning {
        background-color: var(--warning-color);
    }

    .status-dot-danger {
        background-color: var(--danger-color);
    }

    /* Action Buttons Container */
    .action-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    /* Add Transitioning Button Styling */
    #add-transitioning-btn {
        display: block !important;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
        color: white !important;
        padding: 0.625rem 1.25rem !important;
        border-radius: var(--radius) !important;
        border: none !important;
        cursor: pointer !important;
        margin: 0.25rem !important;
        font-weight: 500 !important;
        transition: all 0.2s ease !important;
        box-shadow: var(--shadow) !important;
    }

    #add-transitioning-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: var(--shadow-lg) !important;
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%) !important;
    }

    /* Messaging Button Styling */
    .messaging-btn {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%) !important;
        color: white !important;
        padding: 0.625rem 1.25rem !important;
        border-radius: var(--radius) !important;
        border: none !important;
        cursor: pointer !important;
        margin: 0.25rem !important;
        font-weight: 500 !important;
        transition: all 0.2s ease !important;
        box-shadow: var(--shadow) !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.5rem !important;
    }

    .messaging-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: var(--shadow-lg) !important;
        background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%) !important;
    }

    /* Inbox Button Styling */
    .inbox-btn {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
        color: white !important;
        padding: 0.625rem 1.25rem !important;
        border-radius: var(--radius) !important;
        border: none !important;
        cursor: pointer !important;
        margin: 0.25rem !important;
        font-weight: 500 !important;
        transition: all 0.2s ease !important;
        box-shadow: var(--shadow) !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 0.5rem !important;
        position: relative;
    }

    .inbox-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: var(--shadow-lg) !important;
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
    }

    .inbox-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background-color: #ef4444;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        font-weight: bold;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .hero-section {
            padding: 1.5rem;
        }
        
        .hero-title {
            font-size: 1.5rem;
        }
        
        .dashboard-grid {
            grid-template-columns: 1fr;
        }
        
        .action-buttons {
            flex-direction: column;
        }
        
        .action-buttons .btn {
            width: 100%;
        }
        
        .modal-content {
            max-width: 95%;
        }
    }

    /* Calendar View Styles */
    .calendar-view {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .calendar-day {
        background: var(--light-color);
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        padding: 0.75rem;
        min-height: 100px;
    }

    .calendar-day-header {
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--dark-color);
        margin-bottom: 0.5rem;
        padding-bottom: 0.25rem;
        border-bottom: 1px solid var(--border-color);
    }

    .calendar-event {
        background: white;
        border-left: 3px solid var(--primary-color);
        padding: 0.375rem;
        margin-bottom: 0.25rem;
        font-size: 0.75rem;
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-sm);
    }

    .calendar-event-time {
        font-size: 0.7rem;
        color: var(--dark-color);
        opacity: 0.8;
    }

    /* Student Actions Container */
    .student-actions-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1.5rem;
        margin-bottom: 2rem;
    }

    .student-action-card {
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        padding: 1rem;
        transition: all 0.2s ease;
    }

    .student-action-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow);
    }

    /* Wider report textareas */
    .report-textarea {
        min-height: 150px;
        font-size: 1.05rem;
        line-height: 1.5;
    }

    /* Edit Schedule Button */
    .edit-schedule-btn {
        background-color: var(--info-color);
        color: white;
        border: none;
        padding: 0.375rem 0.75rem;
        border-radius: var(--radius);
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .edit-schedule-btn:hover {
        background-color: #2563eb;
    }

    /* File Upload Styles */
    .file-upload-container {
        border: 2px dashed var(--border-color);
        border-radius: var(--radius);
        padding: 1.5rem;
        text-align: center;
        transition: all 0.2s ease;
        cursor: pointer;
    }

    .file-upload-container:hover {
        border-color: var(--primary-color);
        background-color: var(--primary-light);
    }

    .file-upload-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
    }

    .file-upload-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
        color: var(--primary-color);
    }

    .file-preview {
        margin-top: 1rem;
        padding: 0.75rem;
        background-color: var(--light-color);
        border-radius: var(--radius);
    }

    .file-name {
        font-size: 0.875rem;
        color: var(--dark-color);
        margin-bottom: 0.25rem;
    }

    .file-size {
        font-size: 0.75rem;
        color: var(--dark-color);
        opacity: 0.7;
    }

    /* Email Settings Section */
    .email-settings {
        background-color: var(--light-color);
        border-radius: var(--radius);
        padding: 1rem;
        margin-top: 1rem;
    }

    .email-preview {
        background-color: white;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 1rem;
        margin-top: 1rem;
        font-size: 0.875rem;
        line-height: 1.5;
    }

    .email-preview-header {
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
    }

    /* Messaging Modal Styles - WhatsApp-like UI */
    .whatsapp-chat-container {
        display: flex;
        flex-direction: column;
        height: 500px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        overflow: hidden;
    }

    .chat-header {
        background: linear-gradient(135deg, #128c7e 0%, #075e54 100%);
        color: white;
        padding: 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .chat-header-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .chat-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        color: #128c7e;
    }

    .chat-header-text h4 {
        margin: 0;
        font-weight: 600;
    }

    .chat-header-text p {
        margin: 0;
        font-size: 0.8rem;
        opacity: 0.9;
    }

    .chat-messages {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
        background-color: #e5ddd5;
        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23a8a8a8' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E");
    }

    .message-bubble {
        max-width: 70%;
        padding: 0.5rem 0.75rem;
        border-radius: 1rem;
        margin-bottom: 0.5rem;
        position: relative;
        word-wrap: break-word;
    }

    .message-bubble.sent {
        background-color: #dcf8c6;
        align-self: flex-end;
        margin-left: auto;
        border-bottom-right-radius: 0.25rem;
    }

    .message-bubble.received {
        background-color: white;
        align-self: flex-start;
        margin-right: auto;
        border-bottom-left-radius: 0.25rem;
    }

    .message-content {
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .message-time {
        font-size: 0.7rem;
        color: #666;
        text-align: right;
        margin-top: 0.25rem;
    }

    .message-sender {
        font-weight: 600;
        font-size: 0.8rem;
        margin-bottom: 0.25rem;
        color: #333;
    }

    .chat-input-area {
        padding: 0.75rem;
        background-color: white;
        border-top: 1px solid var(--border-color);
        display: flex;
        gap: 0.5rem;
    }

    .chat-input {
        flex: 1;
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: 2rem;
        font-size: 0.9rem;
    }

    .chat-input:focus {
        outline: none;
        border-color: #128c7e;
    }

    .send-message-btn {
        background-color: #128c7e;
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .send-message-btn:hover {
        background-color: #075e54;
    }

    .message-recipient-options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin: 1.5rem 0;
    }

    .recipient-option {
        border: 2px solid var(--border-color);
        border-radius: var(--radius);
        padding: 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
    }

    .recipient-option:hover {
        border-color: var(--primary-color);
        background-color: var(--primary-light);
    }

    .recipient-option.selected {
        border-color: var(--primary-color);
        background-color: var(--primary-light);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .recipient-option input[type="radio"] {
        margin-right: 0.5rem;
    }

    .recipient-label {
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    /* Parent Selection Styles */
    .parent-select-container {
        margin-bottom: 1.5rem;
    }

    .parent-checkbox-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        padding: 1rem;
        margin-top: 0.5rem;
    }

    .parent-checkbox-item {
        display: flex;
        align-items: center;
        padding: 0.5rem;
        border-bottom: 1px solid var(--border-color);
        transition: background-color 0.2s ease;
    }

    .parent-checkbox-item:hover {
        background-color: var(--light-color);
    }

    .parent-checkbox-item:last-child {
        border-bottom: none;
    }

    .parent-info {
        margin-left: 0.75rem;
        flex: 1;
    }

    .parent-name {
        font-weight: 600;
        font-size: 0.9rem;
    }

    .parent-students {
        font-size: 0.8rem;
        color: var(--dark-color);
        opacity: 0.8;
        margin-top: 0.125rem;
    }

    .student-checkboxes {
        margin-left: 2rem;
        margin-top: 0.5rem;
        padding: 0.5rem;
        background-color: #f8fafc;
        border-radius: var(--radius-sm);
    }

    .student-checkbox-item {
        display: flex;
        align-items: center;
        padding: 0.25rem 0;
    }

    /* Inbox Modal Styles */
    .inbox-container {
        display: flex;
        height: 600px;
    }

    .conversations-sidebar {
        width: 300px;
        border-right: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
    }

    .conversations-header {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        font-weight: 600;
    }

    .conversations-list {
        flex: 1;
        overflow-y: auto;
    }

    .conversation-item {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .conversation-item:hover {
        background-color: var(--light-color);
    }

    .conversation-item.active {
        background-color: var(--primary-light);
        border-left: 3px solid var(--primary-color);
    }

    .conversation-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .conversation-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: var(--primary-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
    }

    .conversation-details {
        flex: 1;
    }

    .conversation-title {
        font-weight: 600;
        margin: 0;
        display: flex;
        justify-content: space-between;
    }

    .conversation-preview {
        font-size: 0.85rem;
        color: #666;
        margin: 0.25rem 0 0 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .conversation-time {
        font-size: 0.75rem;
        color: #999;
    }

    .conversation-unread {
        background-color: var(--primary-color);
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        font-weight: 600;
    }

    .chat-main {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    /* New message indicator */
    .new-message-indicator {
        background-color: #ef4444;
        color: white;
        border-radius: 50%;
        width: 8px;
        height: 8px;
        display: inline-block;
        margin-left: 0.5rem;
    }

    /* Parent/Management Message Styles */
    .message-context {
        font-size: 0.75rem;
        color: #666;
        margin-bottom: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .message-context-badge {
        background-color: #e0f2fe;
        color: #0369a1;
        padding: 0.125rem 0.5rem;
        border-radius: 0.75rem;
        font-size: 0.7rem;
    }
`;
document.head.appendChild(style);

// --- Cloudinary Configuration ---
const CLOUDINARY_CONFIG = {
    cloudName: 'dwjq7j5zp',
    uploadPreset: 'tutor_homework',
    apiKey: '963245294794452'
};

// --- Global state to hold report submission status ---
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
let showStudentFees = false;
let showEditDeleteButtons = false;

// --- Pay Scheme Configuration ---
const PAY_SCHEMES = {
    NEW_TUTOR: {
        academic: {
            "Preschool-Grade 2": {2: 50000, 3: 60000, 5: 100000},
            "Grade 3-8": {2: 60000, 3: 70000, 5: 110000},
            "Subject Teachers": {1: 30000, 2: 60000, 3: 70000}
        },
        specialized: {
            individual: {
                "Music": 30000,
                "Native Language": 20000,
                "Foreign Language": 25000,
                "Coding": 30000,
                "ICT": 10000,
                "Chess": 25000,
                "Public Speaking": 25000,
                "English Proficiency": 25000,
                "Counseling Programs": 25000}
        },
        group: {
            "Music": 25000,
            "Native Language": 20000,
            "Foreign Language": 20000,
            "Chess": 20000,
            "Public Speaking": 20000,
            "English Proficiency": 20000,
            "Counseling Programs": 20000
        }
    },
    OLD_TUTOR: {
        academic: {
            "Preschool-Grade 2": {2: 60000, 3: 70000, 5: 110000},
            "Grade 3-8": {2: 70000, 3: 80000, 5: 120000},
            "Subject Teachers": {1: 35000, 2: 70000, 3: 90000}
        },
        specialized: {
            individual: {
                "Music": 35000,
                "Native Language": 25000,
                "Foreign Language": 30000,
                "Coding": 35000,
                "ICT": 12000,
                "Chess": 30000,
                "Public Speaking": 30000,
                "English Proficiency": 30000,
                "Counseling Programs": 30000
            },
            group: {
                "Music": 25000,
                "Native Language": 20000,
                "Foreign Language": 20000,
                "Chess": 20000,
                "Public Speaking": 20000,
                "English Proficiency": 20000,
                "Counseling Programs": 20000
            }
        }
    },
    MANAGEMENT: {
        academic: {
            "Preschool-Grade 2": {2: 70000, 3: 85000, 5: 120000},
            "Grade 3-8": {2: 80000, 3: 90000, 5: 130000},
            "Subject Teachers": {1: 40000, 2: 80000, 3: 100000}
        },
        specialized: {
            individual: {
                "Music": 40000,
                "Native Language": 30000,
                "Foreign Language": 35000,
                "Coding": 40000,
                "Chess": 35000,
                "Public Speaking": 35000,
                "English Proficiency": 35000,
                "Counseling Programs": 35000
            },
            group: {
                "Music": 25000,
                "Native Language": 20000,
                "Foreign Language": 20000,
                "Chess": 20000,
                "Public Speaking": 20000,
                "English Proficiency": 20000,
                "Counseling Programs": 20000
            }
        }
    }
};

// --- Subject Categorization ---
const SUBJECT_CATEGORIES = {
    "Native Language": ["Yoruba", "Igbo", "Hausa"],
    "Foreign Language": ["French", "German", "Spanish", "Arabic"],
    "Specialized": ["Music", "Coding","ICT", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"]
};

// --- UPDATED: Schedule Days and Times with 24-hour support ---
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Create time slots from 00:00 to 23:30 in 30-minute intervals
const TIME_SLOTS = [];
for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
        const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        let label;
        
        if (hour === 0 && minute === 0) {
            label = "12:00 AM (Midnight)";
        } else if (hour === 12 && minute === 0) {
            label = "12:00 PM (Noon)";
        } else {
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            label = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
        }
        
        TIME_SLOTS.push({ value: timeValue, label: label });
    }
}

// Add an extra slot for 23:30 if not already included
if (!TIME_SLOTS.find(slot => slot.value === "23:30")) {
    TIME_SLOTS.push({value: "23:30", label: "11:30 PM"});
}

// Sort time slots in chronological order
TIME_SLOTS.sort((a, b) => {
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    
    return timeToMinutes(a.value) - timeToMinutes(b.value);
});

// --- Phone Number Normalization Function ---
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    
    let cleaned = phone.toString().trim();
    
    if (cleaned.startsWith('+')) {
        const digits = cleaned.substring(1).replace(/\D/g, '');
        return '+' + digits;
    }
    
    if (cleaned.startsWith('0')) {
        const digits = cleaned.replace(/\D/g, '');
        if (digits.startsWith('0')) {
            return '+234' + digits.substring(1);
        }
    }
    
    if (cleaned.match(/^234/)) {
        const digits = cleaned.replace(/\D/g, '');
        return '+' + digits;
    }
    
    const digits = cleaned.replace(/\D/g, '');
    
    if (digits.length === 10 && /^[789]/.test(digits)) {
        return '+234' + digits;
    }
    
    if (digits.length >= 10 && !cleaned.startsWith('+')) {
        return '+' + digits;
    }
    
    if (/^\d+$/.test(cleaned) && !cleaned.startsWith('+')) {
        return '+' + cleaned;
    }
    
    return cleaned;
}

// --- FIXED: Schedule Management Functions - Track scheduled students ---
let allStudents = [];
let scheduledStudents = new Set(); // Track students with schedules
let currentStudentIndex = 0;
let schedulePopup = null;

async function checkAndShowSchedulePopup(tutor) {
    try {
        const studentsQuery = query(
            collection(db, "students"), 
            where("tutorEmail", "==", tutor.email)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        allStudents = [];
        scheduledStudents.clear(); // Reset scheduled students
        
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            // Filter out archived students
            if (!['archived', 'graduated', 'transferred'].includes(student.status)) {
                allStudents.push(student);
                // Check if student already has a schedule
                if (student.schedule && student.schedule.length > 0) {
                    scheduledStudents.add(student.id);
                }
            }
        });
        
        // Filter students that don't have schedules yet
        const studentsWithoutSchedule = allStudents.filter(student => !scheduledStudents.has(student.id));
        
        currentStudentIndex = 0;
        
        if (studentsWithoutSchedule.length > 0) {
            showBulkSchedulePopup(studentsWithoutSchedule[0], tutor, studentsWithoutSchedule.length);
            return true;
        } else {
            showCustomAlert('✅ All students have been scheduled!');
            return false;
        }
        
    } catch (error) {
        console.error("Error checking schedules:", error);
        showCustomAlert('Error loading students. Please try again.');
        return false;
    }
}

// --- FIXED: Time validation to allow 12 AM to 1 AM and overnight classes ---
function validateScheduleTime(start, end) {
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    
    // Allow overnight classes (e.g., 11 PM to 1 AM)
    if (endMinutes < startMinutes) {
        // This is an overnight class (e.g., 23:00 to 01:00)
        // End time is actually the next day
        const adjustedEndMinutes = endMinutes + (24 * 60);
        const duration = adjustedEndMinutes - startMinutes;
        
        // Ensure minimum duration (e.g., at least 30 minutes)
        if (duration < 30) {
            return { valid: false, message: 'Class must be at least 30 minutes long' };
        }
        
        // Ensure maximum duration (e.g., no more than 4 hours)
        if (duration > 4 * 60) {
            return { valid: false, message: 'Class cannot exceed 4 hours' };
        }
        
        return { valid: true, isOvernight: true, duration: duration };
    }
    
    // Normal daytime class
    const duration = endMinutes - startMinutes;
    
    if (duration < 30) {
        return { valid: false, message: 'Class must be at least 30 minutes long' };
    }
    
    if (duration > 4 * 60) {
        return { valid: false, message: 'Class cannot exceed 4 hours' };
    }
    
    return { valid: true, isOvernight: false, duration: duration };
}

function showBulkSchedulePopup(student, tutor, totalCount = 0) {
    if (schedulePopup && document.body.contains(schedulePopup)) {
        schedulePopup.remove();
    }
    
    const popupHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3 class="modal-title">📅 Set Schedule for ${student.studentName}</h3>
                    <span class="badge badge-info">${currentStudentIndex + 1} of ${totalCount}</span>
                </div>
                <div class="modal-body">
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p class="text-sm text-blue-700">Student: <strong>${student.studentName}</strong> | Grade: ${student.grade}</p>
                        <p class="text-xs text-blue-600">${student.subjects ? student.subjects.join(', ') : 'No subjects'}</p>
                        <p class="text-xs text-blue-500 mt-1">Note: You can schedule overnight classes (e.g., 11 PM to 1 AM)</p>
                    </div>
                    
                    <div id="schedule-entries" class="space-y-4">
                        <div class="schedule-entry bg-gray-50 p-4 rounded-lg border">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="form-label">Day of Week</label>
                                    <select class="form-input schedule-day">
                                        ${DAYS_OF_WEEK.map(day => `<option value="${day}">${day}</option>`).join('')}
                                </select>
                                </div>
                                <div>
                                    <label class="form-label">Start Time</label>
                                    <select class="form-input schedule-start">
                                        ${TIME_SLOTS.map(slot => `<option value="${slot.value}">${slot.label}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">End Time</label>
                                    <select class="form-input schedule-end">
                                        ${TIME_SLOTS.map(slot => `<option value="${slot.value}">${slot.label}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <button class="btn btn-danger btn-sm mt-2 remove-schedule-btn hidden">Remove</button>
                        </div>
                    </div>
                    
                    <button id="add-schedule-entry" class="btn btn-secondary btn-sm mt-2">
                        ＋ Add Another Time Slot
                    </button>
                </div>
                <div class="modal-footer">
                    <button id="skip-schedule-btn" class="btn btn-secondary">Skip This Student</button>
                    <button id="save-schedule-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Save & Next Student
                    </button>
                </div>
            </div>
        </div>
    `;
    
    schedulePopup = document.createElement('div');
    schedulePopup.innerHTML = popupHTML;
    document.body.appendChild(schedulePopup);
    
    document.getElementById('add-schedule-entry').addEventListener('click', () => {
        const scheduleEntries = document.getElementById('schedule-entries');
        const newEntry = scheduleEntries.firstElementChild.cloneNode(true);
        newEntry.querySelector('.remove-schedule-btn').classList.remove('hidden');
        scheduleEntries.appendChild(newEntry);
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-schedule-btn')) {
            if (document.querySelectorAll('.schedule-entry').length > 1) {
                e.target.closest('.schedule-entry').remove();
            }
        }
    });
    
    document.getElementById('save-schedule-btn').addEventListener('click', async () => {
        const scheduleEntries = document.querySelectorAll('.schedule-entry');
        const schedule = [];
        let hasError = false;
        
        for (const entry of scheduleEntries) {
            const day = entry.querySelector('.schedule-day').value;
            const start = entry.querySelector('.schedule-start').value;
            const end = entry.querySelector('.schedule-end').value;
            
            const validation = validateScheduleTime(start, end);
            if (!validation.valid) {
                showCustomAlert(validation.message);
                hasError = true;
                break;
            }
            
            schedule.push({ 
                day, 
                start, 
                end,
                isOvernight: validation.isOvernight || false,
                duration: validation.duration
            });
        }
        
        if (hasError) return;
        
        if (schedule.length === 0) {
            showCustomAlert('Please add at least one schedule entry.');
            return;
        }
        
        try {
            const studentRef = doc(db, "students", student.id);
            await updateDoc(studentRef, { schedule });
            
            const scheduleRef = doc(collection(db, "schedules"));
            await setDoc(scheduleRef, {
                studentId: student.id,
                studentName: student.studentName,
                tutorEmail: window.tutorData.email,
                tutorName: window.tutorData.name,
                schedule: schedule,
                createdAt: new Date()
            });
            
            showCustomAlert('✅ Schedule saved!');
            
            // Add student to scheduled set
            scheduledStudents.add(student.id);
            currentStudentIndex++;
            schedulePopup.remove();
            
            // Get remaining students without schedule
            const studentsWithoutSchedule = allStudents.filter(s => !scheduledStudents.has(s.id));
            
            if (currentStudentIndex < studentsWithoutSchedule.length) {
                setTimeout(() => {
                    showBulkSchedulePopup(studentsWithoutSchedule[currentStudentIndex], tutor, studentsWithoutSchedule.length);
                }, 500);
            } else {
                setTimeout(() => {
                    showCustomAlert('🎉 All students have been scheduled!');
                }, 500);
            }
            
        } catch (error) {
            console.error("Error saving schedule:", error);
            showCustomAlert('❌ Error saving schedule. Please try again.');
        }
    });
    
    document.getElementById('skip-schedule-btn').addEventListener('click', () => {
        // Skip this student (don't mark as scheduled)
        currentStudentIndex++;
        schedulePopup.remove();
        
        // Get remaining students without schedule
        const studentsWithoutSchedule = allStudents.filter(s => !scheduledStudents.has(s.id));
        
        if (currentStudentIndex < studentsWithoutSchedule.length) {
            setTimeout(() => {
                showBulkSchedulePopup(studentsWithoutSchedule[currentStudentIndex], tutor, studentsWithoutSchedule.length);
            }, 500);
        } else {
            showCustomAlert('Skipped all remaining students.');
        }
    });
}

// --- SIMPLIFIED: Daily Topic Functions ---
function showDailyTopicModal(student) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h3 class="modal-title">📚 Today's Topic for ${student.studentName}</h3>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Today's Topics *</label>
                        <textarea id="topic-topics" class="form-input form-textarea report-textarea" placeholder="Enter today's topics, one per line or separated by commas..." required></textarea>
                    </div>
                    <div class="mt-2 text-sm text-gray-500">
                        <p>Example: Fractions, Decimals, Basic Algebra</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-topic-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-topic-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Save Today's Topic
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    document.getElementById('cancel-topic-btn').addEventListener('click', () => modal.remove());
    document.getElementById('save-topic-btn').addEventListener('click', async () => {
        const topicData = {
            studentId: student.id,
            studentName: student.studentName,
            tutorEmail: window.tutorData.email,
            tutorName: window.tutorData.name,
            topics: document.getElementById('topic-topics').value.trim(),
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date()
        };
        
        if (!topicData.topics) {
            showCustomAlert('Please enter today\'s topics.');
            return;
        }
        
        try {
            const topicRef = doc(collection(db, "daily_topics"));
            await setDoc(topicRef, topicData);
            modal.remove();
            showCustomAlert('✅ Today\'s topic saved successfully!');
        } catch (error) {
            console.error("Error saving topic:", error);
            showCustomAlert('❌ Error saving topic. Please try again.');
        }
    });
}

// --- UPDATED: Homework Assignment Functions with REAL Cloudinary Upload ---
async function uploadToCloudinary(file, studentId) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        formData.append('folder', 'homework_assignments');
        formData.append('public_id', `homework_${studentId}_${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}`);
        
        // Create upload URL
        const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`;
        
        fetch(uploadUrl, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.secure_url) {
                resolve({
                    url: data.secure_url,
                    publicId: data.public_id,
                    format: data.format,
                    bytes: data.bytes,
                    createdAt: data.created_at
                });
            } else {
                reject(new Error('Upload failed: ' + (data.error?.message || 'Unknown error')));
            }
        })
        .catch(error => {
            reject(error);
        });
    });
}

function showHomeworkModal(student) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const maxDate = nextWeek.toISOString().split('T')[0];
    
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3 class="modal-title">📝 Assign Homework for ${student.studentName}</h3>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Homework Title *</label>
                        <input type="text" id="hw-title" class="form-input" placeholder="e.g., Math Worksheet #3" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description *</label>
                        <textarea id="hw-description" class="form-input form-textarea report-textarea" placeholder="Detailed instructions for the homework..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Due Date *</label>
                        <input type="date" id="hw-due-date" class="form-input" min="${new Date().toISOString().split('T')[0]}" max="${maxDate}" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Upload File (Optional)</label>
                        <div class="file-upload-container" id="file-upload-container">
                            <input type="file" id="hw-file" class="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.ppt,.pptx">
                            <label for="hw-file" class="file-upload-label">
                                <div class="file-upload-icon">📎</div>
                                <span class="text-sm font-medium text-primary-color">Click to upload file</span>
                                <span class="text-xs text-gray-500 block mt-1">PDF, DOC, JPG, PNG, TXT, PPT (Max 10MB)</span>
                            </label>
                            <div id="file-preview" class="file-preview hidden">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <div class="file-name" id="file-name"></div>
                                        <div class="file-size" id="file-size"></div>
                                    </div>
                                    <button type="button" id="remove-file-btn" class="btn btn-danger btn-sm">Remove</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="email-settings">
                        <div class="form-group">
                            <label class="flex items-center space-x-2">
                                <input type="checkbox" id="hw-reminder" class="rounded" checked>
                                <span class="text-sm font-semibold">Send Email Reminder to Parent</span>
                            </label>
                            <p class="text-xs text-gray-500 mt-1">Parent will receive an email reminder 1 day before due date</p>
                        </div>
                        
                        <div id="email-preview" class="email-preview hidden">
                            <div class="email-preview-header">
                                <strong>Email Preview:</strong>
                            </div>
                            <p><strong>Subject:</strong> <span id="email-subject">Homework Reminder for ${student.studentName}</span></p>
                            <p><strong>To:</strong> ${student.parentEmail || 'Parent email will be used'}</p>
                            <p><strong>Message:</strong> <span id="email-message">Don't forget! ${student.studentName} has homework due tomorrow. Please check the assignment details.</span></p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-hw-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-hw-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Assign Homework
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    const fileInput = document.getElementById('hw-file');
    const filePreview = document.getElementById('file-preview');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const emailPreview = document.getElementById('email-preview');
    const emailSubject = document.getElementById('email-subject');
    const emailMessage = document.getElementById('email-message');
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 10 * 1024 * 1024) {
                showCustomAlert('File size must be less than 10MB.');
                fileInput.value = '';
                return;
            }
            
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            filePreview.classList.remove('hidden');
            
            emailMessage.textContent = `Don't forget! ${student.studentName} has homework due tomorrow. A file has been attached to this assignment.`;
        }
    });
    
    removeFileBtn.addEventListener('click', () => {
        fileInput.value = '';
        filePreview.classList.add('hidden');
        emailMessage.textContent = `Don't forget! ${student.studentName} has homework due tomorrow. Please check the assignment details.`;
    });
    
    const reminderCheckbox = document.getElementById('hw-reminder');
    reminderCheckbox.addEventListener('change', () => {
        if (reminderCheckbox.checked) {
            emailPreview.classList.remove('hidden');
            const titleInput = document.getElementById('hw-title');
            titleInput.addEventListener('input', () => {
                emailSubject.textContent = `Homework Reminder: ${titleInput.value || 'Assignment'} for ${student.studentName}`;
            });
        } else {
            emailPreview.classList.add('hidden');
        }
    });
    
    document.getElementById('cancel-hw-btn').addEventListener('click', () => modal.remove());
    document.getElementById('save-hw-btn').addEventListener('click', async () => {
        const hwData = {
            studentId: student.id,
            studentName: student.studentName,
            parentEmail: student.parentEmail || '',
            parentPhone: student.parentPhone,
            tutorEmail: window.tutorData.email,
            tutorName: window.tutorData.name,
            title: document.getElementById('hw-title').value.trim(),
            description: document.getElementById('hw-description').value.trim(),
            dueDate: document.getElementById('hw-due-date').value,
            sendReminder: document.getElementById('hw-reminder').checked,
            assignedDate: new Date(),
            status: 'assigned',
            submissions: []
        };
        
        if (!hwData.title || !hwData.description || !hwData.dueDate) {
            showCustomAlert('Please fill in all required fields (title, description, due date).');
            return;
        }
        
        const dueDate = new Date(hwData.dueDate);
        const today = new Date();
        const maxDueDate = new Date(today);
        maxDueDate.setDate(maxDueDate.getDate() + 7);
        
        if (dueDate < today) {
            showCustomAlert('Due date cannot be in the past.');
            return;
        }
        
        if (dueDate > maxDueDate) {
            showCustomAlert('Due date must be within 7 days from today.');
            return;
        }
        
        try {
            let fileData = null;
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                showCustomAlert('📤 Uploading file to Cloudinary...');
                
                fileData = await uploadToCloudinary(file, student.id);
                
                hwData.fileUrl = fileData.url;
                hwData.fileName = file.name;
                hwData.fileSize = file.size;
                hwData.fileType = file.type;
                hwData.cloudinaryPublicId = fileData.publicId;
            }
            
            const hwRef = doc(collection(db, "homework_assignments"));
            await setDoc(hwRef, hwData);
            
            if (hwData.sendReminder && hwData.parentEmail) {
                await scheduleEmailReminder(hwData, fileData?.url);
            }
            
            modal.remove();
            showCustomAlert('✅ Homework assigned successfully! ' + 
                (hwData.sendReminder && hwData.parentEmail ? 'Email reminder will be sent 1 day before due date.' : ''));
            
        } catch (error) {
            console.error("Error assigning homework:", error);
            showCustomAlert('❌ Error assigning homework: ' + error.message);
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function scheduleEmailReminder(hwData, fileUrl = '') {
    try {
        const dueDate = new Date(hwData.dueDate);
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - 1);
        
        const reminderData = {
            homeworkId: hwData.id,
            studentId: hwData.studentId,
            studentName: hwData.studentName,
            parentEmail: hwData.parentEmail,
            tutorEmail: hwData.tutorEmail,
            tutorName: hwData.tutorName,
            title: hwData.title,
            description: hwData.description,
            dueDate: hwData.dueDate,
            reminderDate: reminderDate,
            fileUrl: fileUrl,
            fileName: hwData.fileName,
            status: 'scheduled',
            createdAt: new Date()
        };
        
        const reminderRef = doc(collection(db, "email_reminders"));
        await setDoc(reminderRef, reminderData);
        
        console.log('Email reminder scheduled for:', reminderDate);
        
    } catch (error) {
        console.error("Error scheduling email reminder:", error);
    }
}

// --- ENHANCED: Messaging Feature with Inbox ---
let unreadMessageCount = 0;

// Get messages from tutor_messages collection (both management and parent messages)
async function updateUnreadMessageCount() {
    try {
        const tutorEmail = window.tutorData?.email;
        if (!tutorEmail) return;
        
        // Check ALL messages where tutorEmail matches
        const messagesQuery = query(
            collection(db, "tutor_messages"),
            where("tutorEmail", "==", tutorEmail),
            where("read", "==", false)
        );
        
        const messagesSnapshot = await getDocs(messagesQuery);
        unreadMessageCount = messagesSnapshot.size;
        
        // Update inbox button badge
        const inboxBtn = document.getElementById('inbox-btn');
        if (inboxBtn) {
            const existingBadge = inboxBtn.querySelector('.inbox-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            if (unreadMessageCount > 0) {
                const badge = document.createElement('span');
                badge.className = 'inbox-badge';
                badge.textContent = unreadMessageCount > 99 ? '99+' : unreadMessageCount;
                inboxBtn.appendChild(badge);
            }
        }
    } catch (error) {
        console.error("Error updating unread message count:", error);
    }
}

// Enhanced messaging modal with parent selection
async function showMessagingModal() {
    try {
        // Load tutor's students
        const studentsQuery = query(
            collection(db, "students"), 
            where("tutorEmail", "==", window.tutorData.email)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        const students = [];
        const parentsMap = new Map(); // parentEmail -> {parentName, students: []}
        
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            students.push(student);
            
            if (student.parentEmail) {
                const parentEmail = student.parentEmail;
                if (!parentsMap.has(parentEmail)) {
                    parentsMap.set(parentEmail, {
                        email: parentEmail,
                        name: student.parentName || 'Parent',
                        phone: student.parentPhone,
                        students: []
                    });
                }
                parentsMap.get(parentEmail).students.push({
                    id: student.id,
                    name: student.studentName,
                    grade: student.grade
                });
            }
        });
        
        const parents = Array.from(parentsMap.values());
        
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-content max-w-3xl">
                    <div class="modal-header">
                        <h3 class="modal-title">💬 Send Message</h3>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Select Recipient Type</label>
                            <div class="message-recipient-options">
                                <div class="recipient-option" data-recipient="management">
                                    <label class="recipient-label">
                                        <input type="radio" name="recipient-type" id="recipient-management" value="management" checked>
                                        📋 Management Team
                                    </label>
                                    <p class="text-xs text-gray-500 mt-1">Send to admin/management team</p>
                                </div>
                                <div class="recipient-option" data-recipient="parent">
                                    <label class="recipient-label">
                                        <input type="radio" name="recipient-type" id="recipient-parent" value="parent">
                                        👨‍👩‍👧‍👦 Parent
                                    </label>
                                    <p class="text-xs text-gray-500 mt-1">Send to a specific parent</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Parent Selection Section (Hidden by default) -->
                        <div id="parent-selection-section" class="hidden">
                            <div class="form-group parent-select-container">
                                <label class="form-label">Select Parent</label>
                                <div class="parent-checkbox-list" id="parent-checkbox-list">
                                    ${parents.length === 0 ? 
                                        '<div class="text-center p-4 text-gray-500">No parents found for your students.</div>' : 
                                        parents.map(parent => `
                                            <div class="parent-checkbox-item">
                                                <input type="checkbox" id="parent-${parent.email.replace(/[@.]/g, '-')}" 
                                                       class="parent-checkbox" value="${parent.email}" data-parent-name="${parent.name}">
                                                <div class="parent-info">
                                                    <div class="parent-name">${parent.name}</div>
                                                    <div class="parent-students">
                                                        Students: ${parent.students.map(s => s.name).join(', ')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="student-checkboxes hidden" id="students-${parent.email.replace(/[@.]/g, '-')}">
                                                <label class="form-label text-sm">Select student(s) for this message:</label>
                                                ${parent.students.map(student => `
                                                    <div class="student-checkbox-item">
                                                        <input type="checkbox" id="student-${student.id}" 
                                                               class="student-checkbox" value="${student.id}" 
                                                               data-parent-email="${parent.email}">
                                                        <label for="student-${student.id}" class="ml-2 text-sm">
                                                            ${student.name} (Grade ${student.grade})
                                                        </label>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        `).join('')
                                    }
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Message Subject</label>
                            <input type="text" id="message-subject" class="form-input" placeholder="Enter message subject" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Message *</label>
                            <textarea id="message-content" class="form-input form-textarea report-textarea" rows="6" placeholder="Type your message here..." required></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="flex items-center space-x-2">
                                <input type="checkbox" id="urgent-message" class="rounded">
                                <span class="text-sm font-semibold">Mark as Urgent</span>
                            </label>
                            <p class="text-xs text-gray-500 mt-1">Urgent messages will be highlighted</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cancel-message-btn" class="btn btn-secondary">Cancel</button>
                        <button id="send-message-btn" class="btn btn-primary">Send Message</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = modalHTML;
        document.body.appendChild(modal);
        
        // Handle recipient type selection
        document.querySelectorAll('input[name="recipient-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const parentSection = document.getElementById('parent-selection-section');
                if (e.target.value === 'parent') {
                    parentSection.classList.remove('hidden');
                } else {
                    parentSection.classList.add('hidden');
                }
            });
        });
        
        // Handle parent checkbox selection
        document.querySelectorAll('.parent-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const parentId = e.target.value.replace(/[@.]/g, '-');
                const studentSection = document.getElementById(`students-${parentId}`);
                if (studentSection) {
                    studentSection.classList.toggle('hidden', !e.target.checked);
                    
                    // Uncheck all student checkboxes when parent is unchecked
                    if (!e.target.checked) {
                        studentSection.querySelectorAll('.student-checkbox').forEach(studentCb => {
                            studentCb.checked = false;
                        });
                    }
                }
            });
        });
        
        // Add click handlers for recipient options
        document.querySelectorAll('.recipient-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (e.target.type !== 'radio') {
                    const radio = option.querySelector('input[type="radio"]');
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                    document.querySelectorAll('.recipient-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    option.classList.add('selected');
                }
            });
        });
        
        // Initialize with management selected
        document.querySelector('.recipient-option[data-recipient="management"]').classList.add('selected');
        
        document.getElementById('cancel-message-btn').addEventListener('click', () => modal.remove());
        document.getElementById('send-message-btn').addEventListener('click', async () => {
            await sendMessage(modal, parents);
        });
        
    } catch (error) {
        console.error("Error loading messaging modal:", error);
        showCustomAlert('❌ Error loading messaging. Please try again.');
    }
}

async function sendMessage(modal, parents) {
    const subject = document.getElementById('message-subject').value.trim();
    const content = document.getElementById('message-content').value.trim();
    const isUrgent = document.getElementById('urgent-message').checked;
    const recipientType = document.querySelector('input[name="recipient-type"]:checked').value;
    
    if (!subject || !content) {
        showCustomAlert('Please enter both subject and message content.');
        return;
    }
    
    try {
        if (recipientType === 'management') {
            // Send to management
            const messageData = {
                tutorEmail: window.tutorData.email,
                tutorName: window.tutorData.name,
                subject: subject,
                content: content,
                recipientType: 'management',
                senderType: 'tutor',
                isUrgent: isUrgent,
                status: 'sent',
                read: false,
                createdAt: new Date()
            };
            
            const messageRef = doc(collection(db, "tutor_messages"));
            await setDoc(messageRef, messageData);
            
            modal.remove();
            showCustomAlert('✅ Message sent to Management Team!');
            
        } else if (recipientType === 'parent') {
            // Send to selected parents
            const selectedParents = Array.from(document.querySelectorAll('.parent-checkbox:checked'));
            
            if (selectedParents.length === 0) {
                showCustomAlert('Please select at least one parent.');
                return;
            }
            
            // Collect all selected students
            const selectedStudents = [];
            document.querySelectorAll('.student-checkbox:checked').forEach(cb => {
                selectedStudents.push({
                    studentId: cb.value,
                    parentEmail: cb.getAttribute('data-parent-email')
                });
            });
            
            // Send message to each selected parent
            for (const parentCheckbox of selectedParents) {
                const parentEmail = parentCheckbox.value;
                const parentName = parentCheckbox.getAttribute('data-parent-name');
                const parent = parents.find(p => p.email === parentEmail);
                
                if (parent) {
                    // Get students for this parent
                    const parentStudents = selectedStudents
                        .filter(s => s.parentEmail === parentEmail)
                        .map(s => {
                            const student = parent.students.find(st => st.id === s.studentId);
                            return student ? { id: student.id, name: student.name } : null;
                        })
                        .filter(Boolean);
                    
                    const parentMessage = {
                        tutorEmail: window.tutorData.email,
                        tutorName: window.tutorData.name,
                        subject: subject,
                        content: content,
                        recipientType: 'parent',
                        senderType: 'tutor',
                        parentEmail: parentEmail,
                        parentName: parentName,
                        parentPhone: parent.phone,
                        students: parentStudents,
                        studentNames: parentStudents.map(s => s.name).join(', '),
                        isUrgent: isUrgent,
                        status: 'sent',
                        read: false,
                        createdAt: new Date()
                    };
                    
                    const messageRef = doc(collection(db, "tutor_messages"));
                    await setDoc(messageRef, parentMessage);
                }
            }
            
            modal.remove();
            showCustomAlert(`✅ Message sent to ${selectedParents.length} parent(s)!`);
        }
        
        // Update unread count
        await updateUnreadMessageCount();
        
    } catch (error) {
        console.error("Error sending message:", error);
        showCustomAlert('❌ Error sending message. Please try again.');
    }
}

// Inbox Feature to show messages from both management and parents
function showInboxModal() {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-6xl" style="height: 80vh;">
                <div class="modal-header">
                    <h3 class="modal-title">📨 Inbox</h3>
                    <button id="new-message-btn" class="btn btn-primary btn-sm">💬 New Message</button>
                </div>
                <div class="modal-body" style="padding: 0; flex: 1;">
                    <div class="inbox-container">
                        <div class="conversations-sidebar">
                            <div class="conversations-header">
                                Conversations
                                <button id="refresh-inbox-btn" class="btn btn-secondary btn-sm float-right">🔄</button>
                            </div>
                            <div class="conversations-list" id="conversations-list">
                                <div class="text-center p-4">
                                    <div class="spinner mx-auto mb-2"></div>
                                    <p class="text-gray-500">Loading conversations...</p>
                                </div>
                            </div>
                        </div>
                        <div class="chat-main">
                            <div id="chat-container" class="whatsapp-chat-container">
                                <div class="chat-header">
                                    <div class="chat-header-info">
                                        <div class="chat-avatar">💬</div>
                                        <div class="chat-header-text">
                                            <h4>Select a conversation</h4>
                                            <p>Choose a conversation to view messages</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="chat-messages" id="chat-messages">
                                    <div class="text-center p-8">
                                        <div class="text-gray-400 text-4xl mb-3">💭</div>
                                        <h4 class="font-bold text-gray-600 mb-2">No Conversation Selected</h4>
                                        <p class="text-gray-500">Select a conversation from the sidebar to view messages</p>
                                    </div>
                                </div>
                                <div class="chat-input-area hidden" id="chat-input-area">
                                    <input type="text" id="chat-input" class="chat-input" placeholder="Type a reply...">
                                    <button id="send-chat-btn" class="send-message-btn">📤</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    // Load conversations
    loadAllConversations();
    
    document.getElementById('new-message-btn').addEventListener('click', () => {
        modal.remove();
        showMessagingModal();
    });
    
    document.getElementById('refresh-inbox-btn').addEventListener('click', () => {
        loadAllConversations();
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            modal.remove();
        }
    });
}

// Load messages from tutor_messages collection
async function loadAllConversations() {
    try {
        const tutorEmail = window.tutorData?.email;
        if (!tutorEmail) return;
        
        // Load all messages for this tutor
        const messagesQuery = query(
            collection(db, "tutor_messages"),
            where("tutorEmail", "==", tutorEmail)
        );
        
        const messagesSnapshot = await getDocs(messagesQuery);
        const conversations = new Map();
        
        // Process all messages
        messagesSnapshot.forEach(doc => {
            const message = { id: doc.id, ...doc.data() };
            
            // Determine conversation key based on sender/receiver type
            let conversationKey;
            let conversationTitle;
            let avatar;
            
            if (message.senderType === 'management' || message.recipientType === 'management') {
                // Management conversation
                conversationKey = 'management';
                conversationTitle = 'Management Team';
                avatar = '👔';
            } else if (message.parentEmail) {
                // Parent conversation
                conversationKey = `parent_${message.parentEmail}`;
                conversationTitle = message.parentName || 'Parent';
                avatar = '👨‍👩‍👧‍👦';
            } else {
                // Fallback
                conversationKey = 'other';
                conversationTitle = 'Other';
                avatar = '💬';
            }
            
            if (!conversations.has(conversationKey)) {
                conversations.set(conversationKey, {
                    id: conversationKey,
                    title: conversationTitle,
                    avatar: avatar,
                    parentEmail: message.parentEmail,
                    parentName: message.parentName,
                    lastMessage: message,
                    unread: message.read === false,
                    messages: [message]
                });
            } else {
                const conv = conversations.get(conversationKey);
                conv.messages.push(message);
                if (message.createdAt > conv.lastMessage.createdAt) {
                    conv.lastMessage = message;
                }
                if (message.read === false) {
                    conv.unread = true;
                }
            }
        });
        
        // Convert to array and sort by last message time
        const conversationArray = Array.from(conversations.values());
        conversationArray.sort((a, b) => {
            const timeA = a.lastMessage.createdAt?.toDate ? a.lastMessage.createdAt.toDate() : new Date(a.lastMessage.createdAt);
            const timeB = b.lastMessage.createdAt?.toDate ? b.lastMessage.createdAt.toDate() : new Date(b.lastMessage.createdAt);
            return timeB - timeA; // Newest first
        });
        
        renderConversationsList(conversationArray);
        
    } catch (error) {
        console.error("Error loading conversations:", error);
        document.getElementById('conversations-list').innerHTML = `
            <div class="text-center p-4">
                <div class="text-red-400 text-4xl mb-3">⚠️</div>
                <h4 class="font-bold text-red-600 mb-2">Failed to Load</h4>
                <p class="text-gray-500">Error loading conversations. Please try again.</p>
            </div>
        `;
    }
}

function renderConversationsList(conversations) {
    const container = document.getElementById('conversations-list');
    
    if (conversations.length === 0) {
        container.innerHTML = `
            <div class="text-center p-8">
                <div class="text-gray-400 text-4xl mb-3">📭</div>
                <h4 class="font-bold text-gray-600 mb-2">No Messages</h4>
                <p class="text-gray-500">You don't have any messages yet.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    conversations.forEach(conv => {
        const lastMessageTime = conv.lastMessage.createdAt?.toDate 
            ? conv.lastMessage.createdAt.toDate() 
            : new Date(conv.lastMessage.createdAt);
        
        const preview = conv.lastMessage.content.length > 50 
            ? conv.lastMessage.content.substring(0, 50) + '...' 
            : conv.lastMessage.content;
        
        html += `
            <div class="conversation-item" data-conversation-id="${conv.id}" data-conversation-type="${conv.id === 'management' ? 'management' : 'parent'}">
                <div class="conversation-info">
                    <div class="conversation-avatar">
                        ${conv.avatar}
                    </div>
                    <div class="conversation-details">
                        <div class="conversation-title">
                            <span>${conv.title}</span>
                            <span class="conversation-time">${formatTime(lastMessageTime)}</span>
                        </div>
                        <p class="conversation-preview">
                            ${preview}
                            ${conv.unread ? '<span class="new-message-indicator"></span>' : ''}
                        </p>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add click listeners
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', async () => {
            const conversationId = item.getAttribute('data-conversation-id');
            const conversationType = item.getAttribute('data-conversation-type');
            
            // Remove active class from all items
            document.querySelectorAll('.conversation-item').forEach(i => {
                i.classList.remove('active');
            });
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Load conversation messages
            await loadConversationMessages(conversationId, conversationType);
        });
    });
}

async function loadConversationMessages(conversationId, conversationType) {
    try {
        const tutorEmail = window.tutorData?.email;
        if (!tutorEmail) return;
        
        let messages = [];
        
        if (conversationType === 'management') {
            // Load management messages
            const messagesQuery = query(
                collection(db, "tutor_messages"),
                where("tutorEmail", "==", tutorEmail)
            );
            
            const messagesSnapshot = await getDocs(messagesQuery);
            messagesSnapshot.forEach(doc => {
                const message = doc.data();
                // Filter for management messages
                if (message.senderType === 'management' || message.recipientType === 'management') {
                    messages.push({ id: doc.id, ...message });
                    
                    // Mark as read if unread
                    if (!message.read) {
                        updateDoc(doc.ref, { read: true });
                    }
                }
            });
        } else if (conversationType === 'parent') {
            // Extract parent email from conversationId
            const parentEmail = conversationId.replace('parent_', '');
            
            // Load parent messages for this specific parent
            const messagesQuery = query(
                collection(db, "tutor_messages"),
                where("tutorEmail", "==", tutorEmail),
                where("parentEmail", "==", parentEmail)
            );
            
            const messagesSnapshot = await getDocs(messagesQuery);
            messagesSnapshot.forEach(doc => {
                const message = doc.data();
                messages.push({ id: doc.id, ...message });
                
                // Mark as read if unread
                if (!message.read) {
                    updateDoc(doc.ref, { read: true });
                }
            });
        }
        
        // Sort messages by date
        messages.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return timeA - timeB;
        });
        
        renderChatMessages(messages, conversationId, conversationType);
        
        // Update unread count
        await updateUnreadMessageCount();
        
    } catch (error) {
        console.error("Error loading conversation messages:", error);
        document.getElementById('chat-messages').innerHTML = `
            <div class="text-center p-8">
                <div class="text-red-400 text-4xl mb-3">⚠️</div>
                <h4 class="font-bold text-red-600 mb-2">Failed to Load</h4>
                <p class="text-gray-500">Error loading messages. Please try again.</p>
            </div>
        `;
    }
}

function renderChatMessages(messages, conversationId, conversationType) {
    const chatMessages = document.getElementById('chat-messages');
    const chatInputArea = document.getElementById('chat-input-area');
    const chatContainer = document.getElementById('chat-container');
    const chatHeader = chatContainer.querySelector('.chat-header-info');
    
    // Find conversation info from the active item
    const activeItem = document.querySelector('.conversation-item.active');
    const title = activeItem?.querySelector('.conversation-title span')?.textContent || 
                 (conversationType === 'management' ? 'Management Team' : 'Parent');
    const avatar = conversationType === 'management' ? '👔' : '👨‍👩‍👧‍👦';
    
    // Update chat header
    chatHeader.innerHTML = `
        <div class="chat-avatar">${avatar}</div>
        <div class="chat-header-text">
            <h4>${title}</h4>
            <p>${messages.length} message${messages.length !== 1 ? 's' : ''}</p>
        </div>
    `;
    
    // Show chat input area for replying
    chatInputArea.classList.remove('hidden');
    
    // Clear existing messages
    chatMessages.innerHTML = '';
    
    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="text-center p-8">
                <div class="text-gray-400 text-4xl mb-3">💭</div>
                <h4 class="font-bold text-gray-600 mb-2">No Messages Yet</h4>
                <p class="text-gray-500">Start a conversation by sending a message</p>
            </div>
        `;
    } else {
        messages.forEach(message => {
            const messageTime = message.createdAt?.toDate 
                ? message.createdAt.toDate() 
                : new Date(message.createdAt);
            
            const isSent = message.senderType === 'tutor';
            const senderName = isSent ? 'You' : 
                             (message.senderType === 'management' ? 'Management' : 
                             (message.parentName || 'Parent'));
            
            const context = message.studentNames ? `Regarding: ${message.studentNames}` : 
                          (message.senderType === 'management' ? 'From Management' : 'From Parent');
            
            const messageHTML = `
                <div class="message-bubble ${isSent ? 'sent' : 'received'}">
                    ${!isSent ? `<div class="message-sender">${senderName}</div>` : ''}
                    ${context ? `<div class="message-context"><span class="message-context-badge">${context}</span></div>` : ''}
                    <div class="message-content">${message.content}</div>
                    <div class="message-time">${formatTime(messageTime)} ${message.isUrgent ? '🚨' : ''}</div>
                </div>
            `;
            
            chatMessages.innerHTML += messageHTML;
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Setup send message functionality
    const sendBtn = document.getElementById('send-chat-btn');
    const chatInput = document.getElementById('chat-input');
    
    // Clear existing event listeners
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    const newChatInput = chatInput.cloneNode(true);
    chatInput.parentNode.replaceChild(newChatInput, chatInput);
    
    // Add new event listener for sending replies
    document.getElementById('send-chat-btn').addEventListener('click', async () => {
        await sendReply(conversationId, conversationType, messages[0]);
    });
    
    document.getElementById('chat-input').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await sendReply(conversationId, conversationType, messages[0]);
        }
    });
}

async function sendReply(conversationId, conversationType, originalMessage) {
    const chatInput = document.getElementById('chat-input');
    const messageContent = chatInput.value.trim();
    
    if (!messageContent) {
        showCustomAlert('Please enter a message.');
        return;
    }
    
    try {
        if (conversationType === 'management') {
            // Reply to management
            const messageData = {
                tutorEmail: window.tutorData.email,
                tutorName: window.tutorData.name,
                subject: `Re: ${originalMessage.subject || 'Message'}`,
                content: messageContent,
                recipientType: 'management',
                senderType: 'tutor',
                isUrgent: false,
                status: 'sent',
                read: false,
                createdAt: new Date()
            };
            
            const messageRef = doc(collection(db, "tutor_messages"));
            await setDoc(messageRef, messageData);
            
        } else if (conversationType === 'parent') {
            // Reply to parent
            const parentEmail = conversationId.replace('parent_', '');
            
            // Find the parent's info from the original message
            const messageData = {
                tutorEmail: window.tutorData.email,
                tutorName: window.tutorData.name,
                subject: `Re: ${originalMessage.subject || 'Message'}`,
                content: messageContent,
                recipientType: 'parent',
                senderType: 'tutor',
                parentEmail: parentEmail,
                parentName: originalMessage.parentName || 'Parent',
                parentPhone: originalMessage.parentPhone,
                students: originalMessage.students || [],
                studentNames: originalMessage.studentNames || '',
                isUrgent: false,
                status: 'sent',
                read: false,
                createdAt: new Date()
            };
            
            const messageRef = doc(collection(db, "tutor_messages"));
            await setDoc(messageRef, messageData);
        }
        
        // Clear input
        chatInput.value = '';
        
        // Reload messages
        await loadConversationMessages(conversationId, conversationType);
        
        showCustomAlert('✅ Reply sent!');
        
    } catch (error) {
        console.error("Error sending reply:", error);
        showCustomAlert('❌ Error sending reply. Please try again.');
    }
}

function formatTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60 * 1000) { // Less than 1 minute
        return 'Just now';
    } else if (diff < 60 * 60 * 1000) { // Less than 1 hour
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes}m ago`;
    } else if (diff < 24 * 60 * 60 * 1000) { // Less than 1 day
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 7 * 24 * 60 * 60 * 1000) { // Less than 1 week
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// --- NEW: View Schedule Calendar for All Students ---
function showScheduleCalendarModal() {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-6xl">
                <div class="modal-header">
                    <h3 class="modal-title">📅 Weekly Schedule Calendar</h3>
                    <div class="action-buttons">
                        <button id="print-calendar-btn" class="btn btn-secondary btn-sm">📄 Print/PDF</button>
                        <button id="edit-schedule-btn" class="btn btn-primary btn-sm">✏️ Edit Schedules</button>
                    </div>
                </div>
                <div class="modal-body">
                    <div id="calendar-loading" class="text-center">
                        <div class="spinner mx-auto mb-2"></div>
                        <p class="text-gray-500">Loading schedule calendar...</p>
                    </div>
                    <div id="calendar-view" class="hidden">
                        <!-- Calendar will be loaded here -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="close-calendar-btn" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    loadScheduleCalendar();
    
    document.getElementById('print-calendar-btn').addEventListener('click', () => {
        printCalendar();
    });
    
    document.getElementById('edit-schedule-btn').addEventListener('click', () => {
        modal.remove();
        if (window.tutorData) {
            checkAndShowSchedulePopup(window.tutorData);
        }
    });
    
    document.getElementById('close-calendar-btn').addEventListener('click', () => {
        modal.remove();
    });
}

async function loadScheduleCalendar() {
    try {
        const studentsQuery = query(
            collection(db, "students"), 
            where("tutorEmail", "==", window.tutorData.email)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        const studentsWithSchedule = [];
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            // Filter out archived students
            if (!['archived', 'graduated', 'transferred'].includes(student.status) &&
                student.schedule && student.schedule.length > 0) {
                studentsWithSchedule.push(student);
            }
        });
        
        if (studentsWithSchedule.length === 0) {
            document.getElementById('calendar-view').innerHTML = `
                <div class="text-center p-8">
                    <div class="text-gray-400 text-4xl mb-3">📅</div>
                    <h4 class="font-bold text-gray-600 mb-2">No Schedules Found</h4>
                    <p class="text-gray-500 mb-4">No students have schedules set up yet.</p>
                    <button id="setup-schedules-btn" class="btn btn-primary">Set Up Schedules</button>
                </div>
            `;
            
            document.getElementById('setup-schedules-btn').addEventListener('click', () => {
                document.querySelector('.modal-overlay').remove();
                if (window.tutorData) {
                    checkAndShowSchedulePopup(window.tutorData);
                }
            });
        } else {
            renderCalendarView(studentsWithSchedule);
        }
        
        document.getElementById('calendar-loading').classList.add('hidden');
        document.getElementById('calendar-view').classList.remove('hidden');
        
    } catch (error) {
        console.error("Error loading calendar:", error);
        document.getElementById('calendar-view').innerHTML = `
            <div class="text-center text-red-600 p-8">
                <div class="text-4xl mb-3">⚠️</div>
                <h4 class="font-bold mb-2">Failed to Load Schedule</h4>
                <p class="text-gray-500">Please try again later.</p>
            </div>
        `;
        document.getElementById('calendar-loading').classList.add('hidden');
        document.getElementById('calendar-view').classList.remove('hidden');
    }
}

function renderCalendarView(students) {
    const scheduleByDay = {};
    DAYS_OF_WEEK.forEach(day => {
        scheduleByDay[day] = [];
    });
    
    students.forEach(student => {
        student.schedule.forEach(slot => {
            scheduleByDay[slot.day].push({
                student: student.studentName,
                grade: student.grade,
                start: slot.start,
                end: slot.end,
                time: `${formatScheduleTime(slot.start)} - ${formatScheduleTime(slot.end)}`,
                studentId: student.id,
                isOvernight: slot.isOvernight || false
            });
        });
    });
    
    DAYS_OF_WEEK.forEach(day => {
        scheduleByDay[day].sort((a, b) => {
            return a.start.localeCompare(b.start);
        });
    });
    
    let calendarHTML = `
        <div class="calendar-view">
    `;
    
    DAYS_OF_WEEK.forEach(day => {
        const dayEvents = scheduleByDay[day];
        calendarHTML += `
            <div class="calendar-day">
                <div class="calendar-day-header">${day}</div>
                <div class="calendar-day-events">
                    ${dayEvents.length === 0 ? 
                        '<div class="text-sm text-gray-400 text-center mt-4">No classes</div>' : 
                        dayEvents.map(event => `
                            <div class="calendar-event">
                                <div class="font-medium text-xs">${event.student}</div>
                                <div class="calendar-event-time">${event.time} ${event.isOvernight ? '🌙' : ''}</div>
                                <div class="text-xs text-gray-500">${event.grade}</div>
                                <button class="edit-schedule-btn mt-1" data-student-id="${event.studentId}">Edit</button>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;
    });
    
    calendarHTML += `</div>`;
    
    calendarHTML += `
        <div class="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 class="font-bold text-lg mb-3">Schedule Summary</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p class="text-sm"><span class="font-semibold">Total Students with Schedule:</span> ${students.length}</p>
                    <p class="text-sm"><span class="font-semibold">Total Weekly Classes:</span> ${Object.values(scheduleByDay).reduce((total, day) => total + day.length, 0)}</p>
                </div>
                <div>
                    <p class="text-sm"><span class="font-semibold">Most Scheduled Day:</span> ${getMostScheduledDay(scheduleByDay)}</p>
                    <p class="text-sm"><span class="font-semibold">Earliest Class:</span> ${getEarliestClass(scheduleByDay)}</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('calendar-view').innerHTML = calendarHTML;
    
    document.querySelectorAll('.edit-schedule-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const studentId = e.target.getAttribute('data-student-id');
            const student = students.find(s => s.id === studentId);
            if (student) {
                document.querySelector('.modal-overlay').remove();
                showEditScheduleModal(student);
            }
        });
    });
}

function formatScheduleTime(time) {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function getMostScheduledDay(scheduleByDay) {
    let maxDay = '';
    let maxCount = 0;
    
    for (const [day, classes] of Object.entries(scheduleByDay)) {
        if (classes.length > maxCount) {
            maxCount = classes.length;
            maxDay = day;
        }
    }
    
    return `${maxDay} (${maxCount} classes)`;
}

function getEarliestClass(scheduleByDay) {
    let earliestTime = '23:59';
    let earliestDay = '';
    
    for (const [day, classes] of Object.entries(scheduleByDay)) {
        for (const cls of classes) {
            if (cls.start < earliestTime) {
                earliestTime = cls.start;
                earliestDay = day;
            }
        }
    }
    
    if (earliestDay) {
        return `${formatScheduleTime(earliestTime)} on ${earliestDay}`;
    }
    return 'No classes scheduled';
}

function printCalendar() {
    const printWindow = window.open('', '_blank');
    const calendarContent = document.getElementById('calendar-view').innerHTML;
    
    printWindow.document.write(`
        <html>
            <head>
                <title>Tutor Schedule Calendar</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .calendar-view { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
                    .calendar-day { border: 1px solid #ddd; padding: 10px; min-height: 120px; }
                    .calendar-day-header { font-weight: bold; border-bottom: 1px solid #ddd; margin-bottom: 5px; padding-bottom: 5px; }
                    .calendar-event { background: #f0f0f0; padding: 5px; margin-bottom: 3px; font-size: 12px; }
                    h1 { text-align: center; margin-bottom: 20px; }
                    .summary { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>📅 Tutor Weekly Schedule Calendar</h1>
                ${calendarContent}
                <div class="summary">
                    <p><strong>Tutor:</strong> ${window.tutorData?.name || 'N/A'}</p>
                    <p><strong>Printed on:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 500);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// --- FIXED: Edit schedule modal with proper time validation ---
function showEditScheduleModal(student) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3 class="modal-title">✏️ Edit Schedule for ${student.studentName}</h3>
                </div>
                <div class="modal-body">
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p class="text-sm text-blue-700">Student: <strong>${student.studentName}</strong> | Grade: ${student.grade}</p>
                        <p class="text-xs text-blue-500">Note: You can schedule overnight classes (e.g., 11 PM to 1 AM)</p>
                    </div>
                    
                    <div id="schedule-entries" class="space-y-4">
                        ${student.schedule && student.schedule.length > 0 ? 
                            student.schedule.map(slot => `
                                <div class="schedule-entry bg-gray-50 p-4 rounded-lg border">
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label class="form-label">Day of Week</label>
                                            <select class="form-input schedule-day">
                                                ${DAYS_OF_WEEK.map(day => `<option value="${day}" ${day === slot.day ? 'selected' : ''}>${day}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div>
                                            <label class="form-label">Start Time</label>
                                            <select class="form-input schedule-start">
                                                ${TIME_SLOTS.map(timeSlot => `<option value="${timeSlot.value}" ${timeSlot.value === slot.start ? 'selected' : ''}>${timeSlot.label}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div>
                                            <label class="form-label">End Time</label>
                                            <select class="form-input schedule-end">
                                                ${TIME_SLOTS.map(timeSlot => `<option value="${timeSlot.value}" ${timeSlot.value === slot.end ? 'selected' : ''}>${timeSlot.label}</option>`).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    <button class="btn btn-danger btn-sm mt-2 remove-schedule-btn">Remove</button>
                                </div>
                            `).join('') : 
                            `<div class="schedule-entry bg-gray-50 p-4 rounded-lg border">
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label class="form-label">Day of Week</label>
                                        <select class="form-input schedule-day">
                                            ${DAYS_OF_WEEK.map(day => `<option value="${day}">${day}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="form-label">Start Time</label>
                                        <select class="form-input schedule-start">
                                            ${TIME_SLOTS.map(timeSlot => `<option value="${timeSlot.value}">${timeSlot.label}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="form-label">End Time</label>
                                        <select class="form-input schedule-end">
                                            ${TIME_SLOTS.map(timeSlot => `<option value="${timeSlot.value}">${timeSlot.label}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                <button class="btn btn-danger btn-sm mt-2 remove-schedule-btn hidden">Remove</button>
                            </div>`
                        }
                    </div>
                    
                    <button id="add-schedule-entry" class="btn btn-secondary btn-sm mt-2">
                        ＋ Add Another Time Slot
                    </button>
                </div>
                <div class="modal-footer">
                    <button id="cancel-edit-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-edit-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    document.getElementById('add-schedule-entry').addEventListener('click', () => {
        const scheduleEntries = document.getElementById('schedule-entries');
        const newEntry = scheduleEntries.firstElementChild.cloneNode(true);
        newEntry.querySelector('.remove-schedule-btn').classList.remove('hidden');
        scheduleEntries.appendChild(newEntry);
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-schedule-btn')) {
            if (document.querySelectorAll('.schedule-entry').length > 1) {
                e.target.closest('.schedule-entry').remove();
            }
        }
    });
    
    document.getElementById('cancel-edit-btn').addEventListener('click', () => modal.remove());
    
    document.getElementById('save-edit-btn').addEventListener('click', async () => {
        const scheduleEntries = document.querySelectorAll('.schedule-entry');
        const schedule = [];
        let hasError = false;
        
        for (const entry of scheduleEntries) {
            const day = entry.querySelector('.schedule-day').value;
            const start = entry.querySelector('.schedule-start').value;
            const end = entry.querySelector('.schedule-end').value;
            
            const validation = validateScheduleTime(start, end);
            if (!validation.valid) {
                showCustomAlert(validation.message);
                hasError = true;
                break;
            }
            
            schedule.push({ 
                day, 
                start, 
                end,
                isOvernight: validation.isOvernight || false,
                duration: validation.duration
            });
        }
        
        if (hasError) return;
        
        if (schedule.length === 0) {
            showCustomAlert('Please add at least one schedule entry.');
            return;
        }
        
        try {
            const studentRef = doc(db, "students", student.id);
            await updateDoc(studentRef, { schedule });
            
            // Update schedule document if it exists
            const schedulesQuery = query(
                collection(db, "schedules"),
                where("studentId", "==", student.id)
            );
            const schedulesSnapshot = await getDocs(schedulesQuery);
            
            if (!schedulesSnapshot.empty) {
                const scheduleDoc = schedulesSnapshot.docs[0];
                await updateDoc(doc(db, "schedules", scheduleDoc.id), {
                    schedule: schedule,
                    updatedAt: new Date()
                });
            }
            
            modal.remove();
            showCustomAlert('✅ Schedule updated successfully!');
            
            // Reload calendar if it's open
            if (document.querySelector('.modal-overlay .modal-title')?.textContent.includes('Weekly Schedule Calendar')) {
                document.querySelector('.modal-overlay').remove();
                showScheduleCalendarModal();
            }
            
        } catch (error) {
            console.error("Error saving schedule:", error);
            showCustomAlert('❌ Error saving schedule. Please try again.');
        }
    });
}

// --- Utility Functions ---
function showCustomAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
        type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
        'bg-blue-100 text-blue-800 border border-blue-300'
    }`;
    alertDiv.innerHTML = `
        <div class="flex items-center">
            <span class="mr-2">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// --- Initialize messaging system when tutor is loaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Update unread count every minute
    setInterval(updateUnreadMessageCount, 60000);
    
    // Initial update
    setTimeout(updateUnreadMessageCount, 2000);
});
[file content end]
