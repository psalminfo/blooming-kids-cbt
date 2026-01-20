/*******************************************************************************
 * SECTION 1: IMPORTS & INITIAL SETUP
 ******************************************************************************/

import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc,维护, query, addDoc, writeBatch, deleteDoc, setDoc, deleteField } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/*******************************************************************************
 * SECTION 2: STYLES & CSS
 ******************************************************************************/

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

    .recipient-option input[type="checkbox"] {
        margin-right: 0.5rem;
    }

    .recipient-label {
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
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
`;
document.head.appendChild(style);

/*******************************************************************************
 * SECTION 3: CONFIGURATION & CONSTANTS
 ******************************************************************************/

// Cloudinary Configuration
const CLOUDINARY_CONFIG = {
    cloudName: 'dwjq7j5zp',
    uploadPreset: 'tutor_homework',
    apiKey: '963245294794452'
};

// Global state to hold report submission status
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
let showStudentFees = false;
let showEditDeleteButtons = false;

// Pay Scheme Configuration
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

// Subject Categorization
const SUBJECT_CATEGORIES = {
    "Native Language": ["Yoruba", "Igbo", "Hausa"],
    "Foreign Language": ["French", "German", "Spanish", "Arabic"],
    "Specialized": ["Music", "Coding","ICT", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"]
};

// Schedule Days and Times with 24-hour support
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

/*******************************************************************************
 * SECTION 4: UTILITY FUNCTIONS
 ******************************************************************************/

// Phone Number Normalization Function
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

// Time validation to allow 12 AM to 1 AM and overnight classes
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

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format schedule time for display
function formatScheduleTime(timeString) {
    const [hour, minute] = timeString.split(':').map(Number);
    
    if (hour === 0 && minute === 0) {
        return "12:00 AM (Midnight)";
    }
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Format time for chat display
function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) {
        // Today
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
        // This week
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        // Older
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Clean grade string
function cleanGradeString(grade) {
    if (grade && grade.toLowerCase().includes("grade")) {
        return grade;
    } else {
        return `Grade ${grade}`;
    }
}

// Get current month and year
function getCurrentMonthYear() {
    const now = new Date();
    return now.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// Get most scheduled day from schedule data
function getMostScheduledDay(scheduleByDay) {
    let maxDay = '';
    let maxCount = 0;
    
    DAYS_OF_WEEK.forEach(day => {
        if (scheduleByDay[day].length > maxCount) {
            maxCount = scheduleByDay[day].length;
            maxDay = day;
        }
    });
    
    return maxDay ? `${maxDay} (${maxCount} classes)` : 'None';
}

// Get earliest class from schedule data
function getEarliestClass(scheduleByDay) {
    let earliestTime = "23:59";
    let earliestInfo = "";
    
    DAYS_OF_WEEK.forEach(day => {
        scheduleByDay[day].forEach(event => {
            if (event.start < earliestTime) {
                earliestTime = event.start;
                earliestInfo = `${formatScheduleTime(event.start)} (${event.student} - ${day})`;
            }
        });
    });
    
    return earliestInfo || "No classes scheduled";
}

// Find specialized subject
function findSpecializedSubject(subjects) {
    for (const [category, subjectList] of Object.entries(SUBJECT_CATEGORIES)) {
        for (const subject of subjects) {
            if (subjectList.includes(subject)) {
                return { category, subject };
            }
        }
    }
    return null;
}

// Get tutor pay scheme based on employment date
function getTutorPayScheme(tutor) {
    if (tutor.isManagementStaff) return PAY_SCHEMES.MANAGEMENT;
    
    if (!tutor.employmentDate) return PAY_SCHEMES.NEW_TUTOR;
    
    const employmentDate = new Date(tutor.employmentDate + '-01');
    const currentDate = new Date();
    const monthsDiff = (currentDate.getFullYear() - employmentDate.getFullYear()) * 12 + 
                      (currentDate.getMonth() - employmentDate.getMonth());
    
    return monthsDiff >= 12 ? PAY_SCHEMES.OLD_TUTOR : PAY_SCHEMES.NEW_TUTOR;
}

// Calculate suggested fee based on student and pay scheme
function calculateSuggestedFee(student, payScheme) {
    const grade = student.grade;
    const days = parseInt(student.days) || 0;
    const subjects = student.subjects || [];
    
    const specializedSubject = findSpecializedSubject(subjects);
    if (specializedSubject) {
        const isGroupClass = student.groupClass || false;
        const feeType = isGroupClass ? 'group' : 'individual';
        return payScheme.specialized[feeType][specializedSubject.category] || 0;
    }
    
    let gradeCategory = "Grade 3-8";
    
    if (grade === "Preschool" || grade === "Kindergarten" || grade.includes("Grade 1") || grade.includes("Grade 2")) {
        gradeCategory = "Preschool-Grade 2";
    } else if (parseInt(grade.replace('Grade ', '')) >= 9) {
        return 0;
    }
    
    const isSubjectTeacher = subjects.some(subj => ["Math", "English", "Science"].includes(subj)) && 
                            parseInt(grade.replace('Grade ', '')) >= 5;
    
    if (isSubjectTeacher) {
        return payScheme.academic["Subject Teachers"][days] || 0;
    } else {
        return payScheme.academic[gradeCategory][days] || 0;
    }
}

// Show custom alert
function showCustomAlert(message) {
    const alertModal = document.createElement('div');
    alertModal.className = 'modal-overlay';
    alertModal.innerHTML = `
        <div class="modal-content max-w-sm">
            <div class="modal-body">
                <p class="mb-4 text-center">${message}</p>
                <div class="flex justify-center">
                    <button id="alert-ok-btn" class="btn btn-primary">OK</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(alertModal);
    document.getElementById('alert-ok-btn').addEventListener('click', () => alertModal.remove());
}

// Update active tab
function updateActiveTab(activeTabId) {
    const navTabs = ['navDashboard', 'navStudentDatabase', 'navAutoStudents'];
    navTabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            if (tabId === activeTabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        }
    });
}

/*******************************************************************************
 * SECTION 5: STORAGE MANAGEMENT (Firestore & LocalStorage)
 ******************************************************************************/

// Firestore Functions for Report Persistence
async function saveReportsToFirestore(tutorEmail, reports) {
    try {
        const reportRef = doc(db, "tutor_saved_reports", tutorEmail);
        await setDoc(reportRef, {
            reports: reports,
            lastUpdated: new Date()
        }, { merge: true });
    } catch (error) {
        console.warn('Error saving to Firestore:', error);
        saveReportsToLocalStorage(tutorEmail, reports);
    }
}

async function loadReportsFromFirestore(tutorEmail) {
    try {
        const reportRef = doc(db, "tutor_saved_reports", tutorEmail);
        const docSnap = await getDoc(reportRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.reports || {};
        } else {
            return loadReportsFromLocalStorage(tutorEmail);
        }
    } catch (error) {
        console.warn('Error loading from Firestore, using localStorage:', error);
        return loadReportsFromLocalStorage(tutorEmail);
    }
}

async function clearAllReportsFromFirestore(tutorEmail) {
    try {
        const reportRef = doc(db, "tutor_saved_reports", tutorEmail);
        await updateDoc(reportRef, {
            reports: {},
            lastUpdated: new Date()
        });
    } catch (error) {
        console.warn('Error clearing Firestore reports:', error);
        clearAllReportsFromLocalStorage(tutorEmail);
    }
}

// Local Storage Functions
const getLocalReportsKey = (tutorEmail) => `savedReports_${tutorEmail}`;

function saveReportsToLocalStorage(tutorEmail, reports) {
    try {
        const key = getLocalReportsKey(tutorEmail);
        localStorage.setItem(key, JSON.stringify(reports));
    } catch (error) {
        console.warn('Error saving to local storage:', error);
    }
}

function loadReportsFromLocalStorage(tutorEmail) {
    try {
        const key = getLocalReportsKey(tutorEmail);
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.warn('Error loading from local storage, using empty object:', error);
        return {};
    }
}

function clearAllReportsFromLocalStorage(tutorEmail) {
    try {
        const key = getLocalReportsKey(tutorEmail);
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('Error clearing local storage:', error);
    }
}

/*******************************************************************************
 * SECTION 6: EMPLOYMENT & TIN MANAGEMENT
 ******************************************************************************/

// Employment Date Functions
function shouldShowEmploymentPopup(tutor) {
    if (tutor.employmentDate) return false;
    
    const lastPopupShown = localStorage.getItem(`employmentPopup_${tutor.email}`);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    return !lastPopupShown || lastPopupShown !== currentMonth;
}

function showEmploymentDatePopup(tutor) {
    const popupHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📋 Employment Information</h3>
                </div>
                <div class="modal-body">
                    <p class="text-sm text-gray-600 mb-4">Please provide your employment start date to help us calculate your payments accurately.</p>
                    <div class="form-group">
                        <label class="form-label">Month & Year of Employment</label>
                        <input type="month" id="employment-date" class="form-input" max="${new Date().toISOString().slice(0, 7)}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="save-employment-btn" class="btn btn-primary">Save</button>
                </div>
            </div>
        </div>
    `;
    
    const popup = document.createElement('div');
    popup.innerHTML = popupHTML;
    document.body.appendChild(popup);

    document.getElementById('save-employment-btn').addEventListener('click', async () => {
        const employmentDate = document.getElementById('employment-date').value;
        if (!employmentDate) {
            showCustomAlert('Please select your employment month and year.');
            return;
        }

        try {
            const tutorRef = doc(db, "tutors", tutor.id);
            await updateDoc(tutorRef, { employmentDate: employmentDate });
            localStorage.setItem(`employmentPopup_${tutor.email}`, new Date().toISOString().slice(0, 7));
            popup.remove();
            showCustomAlert('✅ Employment date saved successfully!');
            window.tutorData.employmentDate = employmentDate;
        } catch (error) {
            console.error("Error saving employment date:", error);
            showCustomAlert('❌ Error saving employment date. Please try again.');
        }
    });
}

// TIN Functions
function shouldShowTINPopup(tutor) {
    if (tutor.tinNumber) return false;
    
    const lastPopupShown = localStorage.getItem(`tinPopup_${tutor.email}`);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    return !lastPopupShown || lastPopupShown !== currentMonth;
}

function showTINPopup(tutor) {
    const popupHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📋 Tax Identification Number (TIN)</h3>
                </div>
                <div class="modal-body">
                    <p class="text-sm text-gray-600 mb-4">Please provide your TIN for payment processing and tax documentation.</p>
                    <div class="form-group">
                        <label class="form-label">Tax Identification Number (TIN)</label>
                            <input type="text" id="tin-number" class="form-input" placeholder="Enter your TIN" maxlength="20">
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="no-tin-btn" class="btn btn-secondary">I don't have TIN</button>
                    <button id="save-tin-btn" class="btn btn-primary">Save TIN</button>
                </div>
            </div>
        </div>
    `;
    
    const popup = document.createElement('div');
    popup.innerHTML = popupHTML;
    document.body.appendChild(popup);

    document.getElementById('no-tin-btn').addEventListener('click', () => {
        localStorage.setItem(`tinPopup_${tutor.email}`, new Date().toISOString().slice(0, 7));
        popup.remove();
    });

    document.getElementById('save-tin-btn').addEventListener('click', async () => {
        const tinNumber = document.getElementById('tin-number').value.trim();
        if (!tinNumber) {
            showCustomAlert('Please enter your TIN or click "I don\'t have TIN".');
            return;
        }

        try {
            const tutorRef = doc(db, "tutors", tutor.id);
            await updateDoc(tutorRef, { tinNumber: tinNumber });
            popup.remove();
            showCustomAlert('✅ TIN saved successfully!');
            window.tutorData.tinNumber = tinNumber;
        } catch (error) {
            console.error("Error saving TIN:", error);
            showCustomAlert('❌ Error saving TIN. Please try again.');
        }
    });
}

/*******************************************************************************
 * SECTION 7: SCHEDULE MANAGEMENT (REFACTORED & ROBUST)
 ******************************************************************************/

// --- CONFIGURATION & HELPERS ---

// Generate granular time slots (15-minute increments)
const generateTimeSlots = () => {
    const slots = [];
    // From 6:00 AM to 11:00 PM (23:00)
    for (let hour = 6; hour <= 23; hour++) {
        const hourStr = hour.toString().padStart(2, '0');
        const minutes = ['00', '15', '30', '45'];
        
        minutes.forEach(min => {
            // Format: "14:15"
            const value = `${hourStr}:${min}`;
            // Label: "02:15 PM"
            let labelHour = hour > 12 ? hour - 12 : hour;
            if (labelHour === 0) labelHour = 12; // Handle midnight/noon if needed, though strictly 6am-11pm here
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const label = `${labelHour}:${min} ${ampm}`;
            
            slots.push({ value, label });
        });
    }
    // Add late night/overnight slots if needed (e.g. up to 2 AM)
    ['00', '01', '02'].forEach(hour => {
        const minutes = ['00', '15', '30', '45'];
        minutes.forEach(min => {
            const value = `${hour}:${min}`;
            const label = `${hour === '00' ? 12 : parseInt(hour)}:${min} AM`; // Simple AM handling
            slots.push({ value, label });
        });
    });
    return slots;
};

const ROBUST_TIME_SLOTS = generateTimeSlots();

// Schedule Management State
let allStudents = [];
let scheduledStudents = new Set(); 
let currentStudentIndex = 0;
let schedulePopup = null;
let isFirstScheduleCheck = true; 

/**
 * Main function to check for unscheduled students and trigger the UI.
 * Now includes robust error handling and proper list management.
 */
async function checkAndShowSchedulePopup(tutor) {
    try {
        const studentsQuery = query(
            collection(db, "students"), 
            where("tutorEmail", "==", tutor.email)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        allStudents = [];
        scheduledStudents.clear(); 
        
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            // Filter active students only
            if (!['archived', 'graduated', 'transferred'].includes(student.status)) {
                allStudents.push(student);
                // Check if student has a valid schedule
                if (student.schedule && Array.isArray(student.schedule) && student.schedule.length > 0) {
                    scheduledStudents.add(student.id);
                }
            }
        });
        
        // Filter students that need scheduling
        const studentsWithoutSchedule = allStudents.filter(student => !scheduledStudents.has(student.id));
        
        // Reset index for the new batch
        currentStudentIndex = 0;
        
        if (studentsWithoutSchedule.length > 0) {
            // Show popup for the first unscheduled student (Index 0)
            showBulkSchedulePopup(studentsWithoutSchedule[0], tutor, studentsWithoutSchedule.length);
            isFirstScheduleCheck = false; 
            return true;
        } else {
            // Everyone is scheduled
            if (isFirstScheduleCheck) {
                console.log("Auto-check: All students scheduled. Silent.");
                isFirstScheduleCheck = false; 
                return false;
            } else {
                showCustomAlert('✅ All students have been scheduled!');
                return false;
            }
        }
        
    } catch (error) {
        console.error("Error checking schedules:", error);
        showCustomAlert('Error loading students. Please check your connection.');
        return false;
    }
}

/**
 * Renders the scheduling modal.
 * Now supports clearing schedules and granular times.
 */
function showBulkSchedulePopup(student, tutor, remainingCount = 0) {
    if (schedulePopup && document.body.contains(schedulePopup)) {
        schedulePopup.remove();
    }
    
    // Check if student already has data (for editing cases)
    const existingSchedule = student.schedule || [];

    const popupHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3 class="modal-title">📅 Set Schedule for ${student.studentName}</h3>
                    <span class="badge badge-info">Queue: ${remainingCount} Remaining</span>
                </div>
                <div class="modal-body">
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="text-sm text-blue-700">Student: <strong>${student.studentName}</strong> | Grade: ${student.grade}</p>
                            <p class="text-xs text-blue-600">${student.subjects ? student.subjects.join(', ') : 'No subjects'}</p>
                        </div>
                        <button id="clear-schedule-btn" class="btn btn-danger btn-sm text-xs">
                            🗑️ Delete Entire Schedule
                        </button>
                    </div>
                    
                    <div id="schedule-entries" class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        </div>
                    
                    <button id="add-schedule-entry" class="btn btn-secondary btn-sm mt-3 w-full border-dashed border-2">
                        ＋ Add Another Time Slot
                    </button>
                </div>
                <div class="modal-footer justify-between">
                    <button id="skip-schedule-btn" class="btn btn-ghost text-gray-500">Skip / Later</button>
                    <button id="save-schedule-btn" class="btn btn-primary" data-student-id="${student.id}">
                        💾 Save Schedule & Next
                    </button>
                </div>
            </div>
        </div>
    `;
    
    schedulePopup = document.createElement('div');
    schedulePopup.innerHTML = popupHTML;
    document.body.appendChild(schedulePopup);
    
    // --- Helper to Create Row HTML ---
    const createRowHTML = (data = null) => {
        // Default to Monday 9am if no data
        const dayVal = data ? data.day : 'Monday';
        const startVal = data ? data.start : '09:00';
        const endVal = data ? data.end : '10:00';

        return `
        <div class="schedule-entry bg-gray-50 p-3 rounded-lg border relative group transition-all hover:shadow-sm">
            <button class="remove-schedule-btn absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md hover:bg-red-600 z-10">✕</button>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label class="text-xs font-semibold text-gray-500 uppercase">Day</label>
                    <select class="form-input schedule-day text-sm">
                        ${DAYS_OF_WEEK.map(day => `<option value="${day}" ${day === dayVal ? 'selected' : ''}>${day}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-500 uppercase">Start Time</label>
                    <select class="form-input schedule-start text-sm">
                        ${ROBUST_TIME_SLOTS.map(slot => `<option value="${slot.value}" ${slot.value === startVal ? 'selected' : ''}>${slot.label}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-500 uppercase">End Time</label>
                    <select class="form-input schedule-end text-sm">
                        ${ROBUST_TIME_SLOTS.map(slot => `<option value="${slot.value}" ${slot.value === endVal ? 'selected' : ''}>${slot.label}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>`;
    };

    // --- Render Initial Rows ---
    const entriesContainer = document.getElementById('schedule-entries');
    
    if (existingSchedule.length > 0) {
        // Load existing schedule
        existingSchedule.forEach(entry => {
            const div = document.createElement('div');
            div.innerHTML = createRowHTML(entry);
            entriesContainer.appendChild(div.firstElementChild); // Append the inner div
        });
    } else {
        // Add one empty row
        const div = document.createElement('div');
        div.innerHTML = createRowHTML();
        entriesContainer.appendChild(div.firstElementChild);
    }

    // --- EVENT LISTENERS ---

    // 1. Add Row
    document.getElementById('add-schedule-entry').addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = createRowHTML(); // Defaults
        entriesContainer.appendChild(div.firstElementChild);
    });

    // 2. Remove Row (Delegated)
    entriesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-schedule-btn')) {
            const row = e.target.closest('.schedule-entry');
            // Allow removing even if it's the last one (user might want to clear manually)
            row.remove();
        }
    });

    // 3. Delete Entire Schedule (Database Wipe)
    document.getElementById('clear-schedule-btn').addEventListener('click', async () => {
        if (!confirm(`Are you sure you want to completely delete the schedule for ${student.studentName}?`)) return;

        try {
            // Update Student Doc (Remove field)
            const studentRef = doc(db, "students", student.id);
            await updateDoc(studentRef, { schedule: deleteField() });

            // Delete specific Schedule Doc
            await deleteDoc(doc(db, "schedules", `sched_${student.id}`));

            showCustomAlert(`🗑️ Schedule deleted for ${student.studentName}`);
            
            // Handle queue logic (treat as scheduled/handled)
            scheduledStudents.delete(student.id); // Ensure they are removed from 'scheduled' set if they were there
            
            moveToNextStudent(false); // False = Don't mark as scheduled

        } catch (error) {
            console.error("Error deleting schedule:", error);
            showCustomAlert('Error deleting schedule.');
        }
    });

    // 4. Save & Next
    document.getElementById('save-schedule-btn').addEventListener('click', async () => {
        const entryDivs = document.querySelectorAll('.schedule-entry');
        const schedule = [];
        let hasError = false;
        
        // Loop through UI rows
        for (const div of entryDivs) {
            const day = div.querySelector('.schedule-day').value;
            const start = div.querySelector('.schedule-start').value;
            const end = div.querySelector('.schedule-end').value;
            
            // Basic Logic Validation
            const validation = validateScheduleTime(start, end); 
            if (!validation.valid) {
                showCustomAlert(`⚠️ ${day}: ${validation.message}`);
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
            // If they save with empty list, treat as "Skip" or "Delete"
            if(confirm("No times slots added. Do you want to save this as an empty schedule (unscheduled)?")) {
                document.getElementById('clear-schedule-btn').click();
                return;
            } else {
                return;
            }
        }
        
        try {
            // A. Update Student Profile (Primary Storage)
            const studentRef = doc(db, "students", student.id);
            await updateDoc(studentRef, { schedule });
            
            // B. Update/Create Central Schedule (Deterministic ID to prevent duplicates)
            const scheduleRef = doc(db, "schedules", `sched_${student.id}`);
            await setDoc(scheduleRef, {
                studentId: student.id,
                studentName: student.studentName,
                tutorEmail: window.tutorData.email,
                tutorName: window.tutorData.name,
                schedule: schedule,
                updatedAt: new Date() // Useful for sorting
            }, { merge: true }); 
            
            showCustomAlert('✅ Schedule saved successfully!');
            
            // Mark as scheduled and move on
            moveToNextStudent(true);
            
        } catch (error) {
            console.error("Error saving:", error);
            showCustomAlert('❌ System Error: Could not save schedule.');
        }
    });
    
    // 5. Skip
    document.getElementById('skip-schedule-btn').addEventListener('click', () => {
        moveToNextStudent(false); // False = Do not mark as scheduled
    });

    // --- QUEUE MANAGEMENT LOGIC ---
    function moveToNextStudent(markAsScheduled) {
        schedulePopup.remove();

        if (markAsScheduled) {
            scheduledStudents.add(student.id);
        } else {
            // If skipping, we just increment the index to look at the next one in the CURRENT list
            currentStudentIndex++;
        }

        // Recalculate the remaining list based on the Set
        const remainingList = allStudents.filter(s => !scheduledStudents.has(s.id));
        
        const nextIndex = markAsScheduled ? 0 : currentStudentIndex;

        if (remainingList.length > 0 && nextIndex < remainingList.length) {
            setTimeout(() => {
                showBulkSchedulePopup(remainingList[nextIndex], tutor, remainingList.length);
            }, 400); // Small delay for UX transition
        } else {
            // End of queue
            if (!markAsScheduled && remainingList.length > 0) {
                 showCustomAlert('End of list (Skipped remaining students).');
            } else {
                 showCustomAlert('🎉 All active students are now scheduled!');
            }
            // Reset index for next time
            currentStudentIndex = 0;
        }
    }
}

/*******************************************************************************
 * SECTION 8: DAILY TOPIC & HOMEWORK MANAGEMENT
 ******************************************************************************/

// ==========================================
// 1. DAILY TOPIC FUNCTIONS
// ==========================================

function showDailyTopicModal(student) {
    const date = new Date();
    const monthName = date.toLocaleString('default', { month: 'long' });

    // Use local date for storage/display consistency
    const today = new Date();
    const localDateString = today.getFullYear() + '-' + 
                            String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(today.getDate()).padStart(2, '0');

    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h3 class="modal-title">📚 Daily Topic: ${student.studentName}</h3>
                </div>
                <div class="modal-body">
                    <div id="topic-history-container" class="mb-5 bg-blue-50 p-3 rounded-lg border border-blue-100 hidden">
                        <div class="flex justify-between items-center mb-2">
                            <h5 class="font-bold text-blue-800 text-sm">📅 Topics Covered in ${monthName}</h5>
                            <span id="topic-count-badge" class="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">0</span>
                        </div>
                        <div id="topic-history" class="topic-history text-sm text-gray-700 max-h-60 overflow-y-auto custom-scrollbar">
                            <div class="flex justify-center p-2">
                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Enter Today's Topic *</label>
                        <textarea id="topic-topics" class="form-input form-textarea report-textarea" 
                            placeholder="e.g. Long Division, Introduction to Photosynthesis..." required></textarea>
                    </div>
                    <div class="mt-2 text-xs text-gray-500 flex justify-between">
                        <span>One topic per line recommended.</span>
                        <span>Date: ${localDateString}</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-topic-btn" class="btn btn-secondary">Close</button>
                    <button id="save-topic-btn" class="btn btn-primary" data-student-id="${student.id}">Save Topic</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    loadDailyTopicHistory(student.id);
    setTimeout(() => document.getElementById('topic-topics').focus(), 100);

    // Event Delegation for Edit/Delete buttons
    const historyContainer = document.getElementById('topic-history');
    historyContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const btn = target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;
        const topicId = btn.dataset.id;

        if (action === 'edit') enableTopicEdit(topicId);
        else if (action === 'delete') {
            if (confirm('Are you sure you want to delete this topic?')) await deleteTopic(topicId, student.id);
        }
        else if (action === 'cancel') cancelTopicEdit(topicId);
        else if (action === 'save') await saveTopicEdit(topicId, student.id);
    });

    document.getElementById('cancel-topic-btn').addEventListener('click', () => modal.remove());
    
    document.getElementById('save-topic-btn').addEventListener('click', async () => {
        const topicInput = document.getElementById('topic-topics');
        const content = topicInput.value.trim();
        if (!content) { showCustomAlert('⚠️ Please enter a topic before saving.'); return; }
        
        const tutorName = window.tutorData?.name || "Unknown Tutor";
        const tutorEmail = window.tutorData?.email || "unknown@tutor.com";
        const saveBtn = document.getElementById('save-topic-btn');
        const originalBtnText = saveBtn.innerText;
        
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";

        const topicData = {
            studentId: student.id,
            studentName: student.studentName,
            tutorEmail: tutorEmail,
            tutorName: tutorName,
            topics: content,
            date: localDateString, 
            createdAt: new Date()
        };
        
        try {
            await setDoc(doc(collection(db, "daily_topics")), topicData);
            topicInput.value = '';
            await loadDailyTopicHistory(student.id);
            showCustomAlert('✅ Topic saved!');
            saveBtn.disabled = false;
            saveBtn.innerText = originalBtnText;
        } catch (error) {
            console.error("Error saving topic:", error);
            showCustomAlert('❌ Error saving topic.');
            saveBtn.disabled = false;
            saveBtn.innerText = originalBtnText;
        }
    });
}

// ------------------------------------------
// HELPER FUNCTIONS FOR EDITING
// ------------------------------------------
function enableTopicEdit(topicId) {
    document.getElementById(`text-${topicId}`).classList.add('hidden');
    document.getElementById(`btn-edit-${topicId}`).classList.add('hidden');
    document.getElementById(`btn-delete-${topicId}`).classList.add('hidden');
    document.getElementById(`input-container-${topicId}`).classList.remove('hidden');
    document.getElementById(`action-btns-${topicId}`).classList.remove('hidden');
    const input = document.getElementById(`input-${topicId}`);
    input.value = document.getElementById(`text-${topicId}`).textContent;
    input.focus();
}
function cancelTopicEdit(topicId) {
    document.getElementById(`text-${topicId}`).classList.remove('hidden');
    document.getElementById(`btn-edit-${topicId}`).classList.remove('hidden');
    document.getElementById(`btn-delete-${topicId}`).classList.remove('hidden');
    document.getElementById(`input-container-${topicId}`).classList.add('hidden');
    document.getElementById(`action-btns-${topicId}`).classList.add('hidden');
}
async function saveTopicEdit(topicId, studentId) {
    const newText = document.getElementById(`input-${topicId}`).value.trim();
    if (!newText) { showCustomAlert("Topic cannot be empty."); return; }
    try {
        await updateDoc(doc(db, "daily_topics", topicId), { topics: newText });
        await loadDailyTopicHistory(studentId);
        showCustomAlert("✅ Topic updated!");
    } catch (error) { console.error(error); showCustomAlert("❌ Update failed."); }
}
async function deleteTopic(topicId, studentId) {
    try {
        await deleteDoc(doc(db, "daily_topics", topicId));
        await loadDailyTopicHistory(studentId);
        showCustomAlert("🗑️ Topic deleted.");
    } catch (error) { console.error(error); showCustomAlert("❌ Delete failed."); }
}
async function loadDailyTopicHistory(studentId) {
    const container = document.getElementById('topic-history');
    if (!container) return;
    try {
        const now = new Date();
        const q = query(collection(db, "daily_topics"), where("studentId", "==", studentId));
        const snap = await getDocs(q);
        let data = [];
        snap.forEach(d => {
            let val = d.data(); val.id = d.id;
            val.parsedDate = val.createdAt?.toDate ? val.createdAt.toDate() : new Date(val.createdAt || new Date());
            data.push(val);
        });
        data.sort((a, b) => b.parsedDate - a.parsedDate);
        let html = '<ul class="space-y-3">';
        let count = 0;
        data.forEach(d => {
            if (d.parsedDate.getMonth() === now.getMonth() && d.parsedDate.getFullYear() === now.getFullYear()) {
                count++;
                html += `<li class="flex flex-col border-b border-blue-100 last:border-0 pb-2">
                    <div class="flex justify-between w-full">
                        <div class="flex-1 mr-2"><span class="font-bold text-blue-600 text-xs">${d.parsedDate.toLocaleDateString(undefined,{month:'short',day:'numeric'})}: </span>
                        <span id="text-${d.id}" class="text-sm">${d.topics}</span>
                        <div id="input-container-${d.id}" class="hidden"><textarea id="input-${d.id}" class="w-full text-sm border rounded p-1" rows="2"></textarea></div></div>
                        <div class="flex space-x-1">
                            <button id="btn-edit-${d.id}" data-action="edit" data-id="${d.id}" class="text-gray-400 hover:text-blue-600">✏️</button>
                            <button id="btn-delete-${d.id}" data-action="delete" data-id="${d.id}" class="text-gray-400 hover:text-red-600">🗑️</button>
                            <div id="action-btns-${d.id}" class="hidden flex space-x-1">
                                <button data-action="save" data-id="${d.id}" class="text-green-600">✅</button>
                                <button data-action="cancel" data-id="${d.id}" class="text-red-500">❌</button>
                            </div>
                        </div>
                    </div></li>`;
            }
        });
        html += '</ul>';
        container.innerHTML = count > 0 ? html : '<p class="text-center text-gray-500 italic">No topics yet.</p>';
        document.getElementById('topic-history-container').classList.remove('hidden');
        document.getElementById('topic-count-badge').textContent = count;
    } catch (e) { console.error(e); container.innerHTML = '<p class="text-red-500">Error loading history.</p>'; }
}


// ==========================================
// 2. HOMEWORK ASSIGNMENT
// ==========================================

async function uploadToCloudinary(file, studentId) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        formData.append('folder', 'homework_assignments');
        formData.append('public_id', `homework_${studentId}_${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}`);
        
        fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: formData })
        .then(r => r.json())
        .then(d => d.secure_url ? resolve({url: d.secure_url, publicId: d.public_id, format: d.format, bytes: d.bytes, createdAt: d.created_at, fileName: file.name}) : reject(new Error(d.error?.message)))
        .catch(e => reject(e));
    });
}

async function fetchParentDataByPhone(phone) {
    if (!phone) return null;
    try {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, ''); 
        let q = query(collection(db, "parent_users"), where("phone", "==", phone));
        let snapshot = await getDocs(q);
        
        if (snapshot.empty && cleanPhone !== phone) {
            q = query(collection(db, "parent_users"), where("phone", "==", cleanPhone));
            snapshot = await getDocs(q);
        }

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            return { 
                email: data.email, 
                name: data.fullName || data.name || data.parentName || "Parent" 
            };
        }
    } catch (error) {
        console.error("Error fetching parent data:", error);
    }
    return null;
}

function showHomeworkModal(student) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const maxDate = nextWeek.toISOString().split('T')[0];
    let selectedFiles = [];

    let currentParentName = student.parentName || "Loading...";
    let currentParentEmail = student.parentEmail || "Searching...";
    const parentPhone = student.parentPhone || "Not Found";

    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header"><h3 class="modal-title">📝 Assign Homework for ${student.studentName}</h3></div>
                <div class="modal-body">
                    <div class="form-group"><label class="form-label">Title *</label><input type="text" id="hw-title" class="form-input" required></div>
                    <div class="form-group"><label class="form-label">Description *</label><textarea id="hw-description" class="form-input form-textarea" required></textarea></div>
                    <div class="form-group"><label class="form-label">Due Date *</label><input type="date" id="hw-due-date" class="form-input" max="${maxDate}" required></div>
                    <div class="form-group"><label class="form-label">Files (Max 5)</label>
                        <div class="file-upload-container"><input type="file" id="hw-file" class="hidden" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt">
                        <label for="hw-file" class="file-upload-label"><span class="text-primary-color">Click to upload files</span></label>
                        <div id="file-list-preview" class="hidden mt-2"><ul id="file-list-ul"></ul><button id="remove-all-files-btn" class="btn btn-danger btn-sm w-full mt-2">Clear Files</button></div></div>
                    </div>
                    
                    <div class="email-settings bg-blue-50 p-3 rounded mt-2 border border-blue-100">
                        <label class="flex items-center space-x-2 mb-2"><input type="checkbox" id="hw-reminder" class="rounded" checked><span class="font-bold text-blue-900">Notify Parent via Email</span></label>
                        <div class="grid grid-cols-2 gap-2 text-xs text-gray-700">
                            <div><span class="font-semibold">Parent:</span> <span id="display-parent-name">${currentParentName}</span></div>
                            <div><span class="font-semibold">Phone:</span> ${parentPhone}</div>
                            <div class="col-span-2"><span class="font-semibold">Email:</span> <span id="display-parent-email">${currentParentEmail}</span></div>
                        </div>
                        <div id="new-data-badge" class="hidden mt-2 text-xs text-green-600 font-bold">✨ New parent details found! Will be saved to student profile.</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-hw-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-hw-btn" class="btn btn-primary">Assign Homework</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);

    let fetchedParentData = null;

    if (student.parentPhone && (!student.parentEmail || !student.parentName)) {
        fetchParentDataByPhone(student.parentPhone).then(data => {
            if (data) {
                fetchedParentData = data;
                document.getElementById('display-parent-name').textContent = data.name;
                document.getElementById('display-parent-email').textContent = data.email;
                document.getElementById('display-parent-name').classList.add('text-green-600', 'font-bold');
                document.getElementById('display-parent-email').classList.add('text-green-600', 'font-bold');
                document.getElementById('new-data-badge').classList.remove('hidden');
            } else {
                document.getElementById('display-parent-name').textContent = "Unknown";
                document.getElementById('display-parent-email').textContent = "Not found in database";
            }
        });
    } else {
        if(student.parentName) document.getElementById('display-parent-name').textContent = student.parentName;
        if(student.parentEmail) document.getElementById('display-parent-email').textContent = student.parentEmail;
    }

    const fileInput = document.getElementById('hw-file');
    const fileListUl = document.getElementById('file-list-ul');
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (selectedFiles.length + files.length > 5) { showCustomAlert('Max 5 files.'); fileInput.value=''; return; }
        files.forEach(f => { if(f.size<=10*1024*1024) selectedFiles.push(f); else showCustomAlert(`Skipped ${f.name} (>10MB)`); });
        renderFiles();
    });
    function renderFiles() {
        const preview = document.getElementById('file-list-preview');
        if (selectedFiles.length===0) { preview.classList.add('hidden'); return; }
        preview.classList.remove('hidden');
        fileListUl.innerHTML = '';
        selectedFiles.forEach((f, i) => {
            const li = document.createElement('li');
            li.className = "flex justify-between bg-white p-1 mb-1 border rounded text-sm";
            li.innerHTML = `<span>${f.name}</span><span class="text-red-500 cursor-pointer remove-file-btn" data-index="${i}">✕</span>`;
            fileListUl.appendChild(li);
        });
        
        fileListUl.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                selectedFiles.splice(idx, 1);
                renderFiles();
            });
        });
    }
    document.getElementById('remove-all-files-btn').addEventListener('click', ()=>{ selectedFiles=[]; fileInput.value=''; renderFiles(); });
    document.getElementById('cancel-hw-btn').addEventListener('click', () => modal.remove());

    document.getElementById('save-hw-btn').addEventListener('click', async () => {
        const title = document.getElementById('hw-title').value.trim();
        const desc = document.getElementById('hw-description').value.trim();
        const date = document.getElementById('hw-due-date').value;
        const sendEmail = document.getElementById('hw-reminder').checked;
        const saveBtn = document.getElementById('save-hw-btn');

        if (!title || !desc || !date) { showCustomAlert('Please fill all fields.'); return; }
        
        const tutorName = window.tutorData?.name || "Unknown Tutor";
        const today = new Date(); today.setHours(0,0,0,0);
        const due = new Date(date); due.setHours(0,0,0,0);
        if(due < today) { showCustomAlert('Due date cannot be past.'); return; }

        try {
            saveBtn.disabled = true;
            
            let finalParentEmail = fetchedParentData?.email || student.parentEmail || "";
            let finalParentName = fetchedParentData?.name || student.parentName || "";

            if (sendEmail && !finalParentEmail && student.parentPhone) {
                saveBtn.innerHTML = "🔍 Finalizing Parent Info...";
                const lastCheck = await fetchParentDataByPhone(student.parentPhone);
                if (lastCheck) {
                    finalParentEmail = lastCheck.email;
                    finalParentName = lastCheck.name;
                    fetchedParentData = lastCheck; 
                }
            }

            if (fetchedParentData) {
                saveBtn.innerHTML = "💾 Syncing Student Data...";
                try {
                    await updateDoc(doc(db, "students", student.id), {
                        parentEmail: finalParentEmail,
                        parentName: finalParentName
                    });
                } catch (updateError) {
                    console.error("Failed to sync student data:", updateError);
                }
            }

            saveBtn.innerHTML = `Uploading ${selectedFiles.length} files...`;
            let attachments = [];
            if (selectedFiles.length > 0) {
                try {
                    const uploadPromises = selectedFiles.map(f => uploadToCloudinary(f, student.id));
                    const results = await Promise.all(uploadPromises);
                    results.forEach(res => attachments.push({url:res.url, name:res.fileName, size:res.bytes, type:res.format}));
                } catch(e) { 
                    console.error("Upload Error:", e);
                    showCustomAlert(`Upload failed: ${e.message}`); 
                    saveBtn.disabled=false; 
                    saveBtn.innerHTML="Assign Homework"; 
                    return; 
                }
            }

            saveBtn.innerHTML = "Saving...";
            const newHwRef = doc(collection(db, "homework_assignments"));
            
            const hwData = {
                id: newHwRef.id,
                studentId: student.id,
                studentName: student.studentName,
                parentEmail: finalParentEmail,
                parentName: finalParentName,
                parentPhone: student.parentPhone,
                tutorName: tutorName,
                title: title,
                description: desc,
                dueDate: date,
                assignedDate: new Date(),
                status: 'assigned',
                attachments: attachments,
                fileUrl: attachments[0]?.url || '', 
                fileName: attachments[0]?.name || '' 
            };
            
            await setDoc(newHwRef, hwData);

            if (sendEmail && finalParentEmail) {
                saveBtn.innerHTML = "Sending Email...";
                const GAS_URL = "https://script.google.com/macros/s/AKfycbz9yuiR1egvxRcCLbW1Id-6lxBsYotiID0j_Fpeb9D8RyQGdMPNPPZn8WqOpJ4m_JqJNQ/exec";
                
                fetch(GAS_URL, {
                    method: 'POST', mode: 'no-cors',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(hwData)
                }).catch(e=>console.error(e));
                
                await scheduleEmailReminder(hwData, hwData.fileUrl);
            }

            modal.remove();
            showCustomAlert(`✅ Assigned! ${finalParentEmail ? 'Email sent to ' + finalParentName : '(No email found)'}`);

        } catch (error) {
            console.error("Save Error:", error);
            showCustomAlert("Error assigning homework.");
            saveBtn.disabled = false;
            saveBtn.innerHTML = "Assign Homework";
        }
    });
}

async function scheduleEmailReminder(hwData, fileUrl = '') {
    if (!hwData.id) return;
    try {
        const d = new Date(hwData.dueDate); d.setDate(d.getDate()-1);
        await setDoc(doc(collection(db, "email_reminders")), {
            homeworkId: hwData.id,
            studentId: hwData.studentId, 
            parentEmail: hwData.parentEmail,
            parentName: hwData.parentName || "Parent",
            title: hwData.title, 
            dueDate: hwData.dueDate, 
            reminderDate: d,
            status: 'scheduled', 
            createdAt: new Date()
        });
    } catch(e){ console.error("Error scheduling reminder:", e); }
}

/*******************************************************************************
 * SECTION 9: MESSAGING & INBOX FEATURES
 ******************************************************************************/

// --- STATE MANAGEMENT ---
let msgSectionUnreadCount = 0;
let btnFloatingMsg = null;
let btnFloatingInbox = null;

// --- LISTENERS ---
let unsubInboxListener = null;
let unsubChatListener = null;
let unsubUnreadListener = null;

// --- UTILITY FUNCTIONS ---

function msgEscapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function msgGenerateConvId(tutorId, parentPhone) {
    return [tutorId, parentPhone].sort().join("_");
}

function msgFormatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- INITIALIZATION ---

function initializeFloatingMessagingButton() {
    const oldBtns = document.querySelectorAll('.floating-messaging-btn, .floating-inbox-btn');
    oldBtns.forEach(btn => btn.remove());
    
    btnFloatingMsg = document.createElement('button');
    btnFloatingMsg.className = 'floating-messaging-btn';
    btnFloatingMsg.innerHTML = `<span class="floating-btn-icon">💬</span><span class="floating-btn-text">New</span>`;
    btnFloatingMsg.onclick = showEnhancedMessagingModal;
    
    btnFloatingInbox = document.createElement('button');
    btnFloatingInbox.className = 'floating-inbox-btn';
    btnFloatingInbox.innerHTML = `<span class="floating-btn-icon">📨</span><span class="floating-btn-text">Inbox</span>`;
    btnFloatingInbox.onclick = showInboxModal;
    
    document.body.appendChild(btnFloatingMsg);
    document.body.appendChild(btnFloatingInbox);
    
    injectMessagingStyles();
    
    if (window.tutorData && window.tutorData.id) {
        initializeUnreadListener();
    }
}

// --- BACKGROUND LISTENERS ---

function initializeUnreadListener() {
    const tutorId = window.tutorData.id;
    if (unsubUnreadListener) unsubUnreadListener();

    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", tutorId)
    );

    unsubUnreadListener = onSnapshot(q, (snapshot) => {
        let count = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.unreadCount > 0 && data.lastSenderId !== tutorId) {
                count += data.unreadCount;
            }
        });
        
        msgSectionUnreadCount = count;
        updateFloatingBadges();
    });
}

window.updateUnreadMessageCount = function() {
    if (window.tutorData && window.tutorData.id) {
        initializeUnreadListener();
    }
};

function updateFloatingBadges() {
    const updateBadge = (btn) => {
        if (!btn) return;
        const existing = btn.querySelector('.unread-badge');
        if (existing) existing.remove();

        if (msgSectionUnreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'unread-badge';
            badge.textContent = msgSectionUnreadCount > 99 ? '99+' : msgSectionUnreadCount;
            btn.appendChild(badge);
        }
    };
    updateBadge(btnFloatingMsg);
    updateBadge(btnFloatingInbox);
}

// --- FEATURE 1: SEND MESSAGE MODAL ---

function showEnhancedMessagingModal() {
    document.querySelectorAll('.enhanced-messaging-modal').forEach(e => e.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay enhanced-messaging-modal';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div class="modal-content messaging-modal-content">
            <div class="modal-header">
                <h3>💬 Send Message</h3>
                <button type="button" class="close-modal-btn text-2xl font-bold">&times;</button>
            </div>
            <div class="modal-body">
                <div class="message-type-grid">
                    <div class="type-option selected" data-type="individual">
                        <div class="icon">👤</div><div>Individual</div>
                    </div>
                    <div class="type-option" data-type="group">
                        <div class="icon">👨‍👩‍👧‍👦</div><div>Group</div>
                    </div>
                    <div class="type-option" data-type="management">
                        <div class="icon">🏢</div><div>Admin</div>
                    </div>
                    <div class="type-option" data-type="all">
                        <div class="icon">📢</div><div>All Parents</div>
                    </div>
                </div>

                <div id="recipient-loader" class="recipient-area"></div>

                <input type="text" id="msg-subject" class="form-input" placeholder="Subject">
                <textarea id="msg-content" class="form-input" rows="5" placeholder="Type your message..."></textarea>
                
                <div class="flex-row-spaced mt-2">
                     <label class="urgent-toggle">
                        <input type="checkbox" id="msg-urgent">
                        <span class="text-red-500 font-bold">Mark as Urgent</span>
                     </label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Cancel</button>
                <button type="button" id="btn-send-initial" class="btn btn-primary">Send Message</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    msgLoadRecipients('individual', modal.querySelector('#recipient-loader'));

    modal.querySelectorAll('.type-option').forEach(opt => {
        opt.onclick = () => {
            modal.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            msgLoadRecipients(opt.dataset.type, modal.querySelector('#recipient-loader'));
        };
    });

    const closeBtns = modal.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(btn => btn.onclick = () => modal.remove());
    
    const sendBtn = modal.querySelector('#btn-send-initial');
    sendBtn.onclick = () => msgProcessSend(modal);
}

async function msgLoadRecipients(type, container) {
    container.innerHTML = '<div class="spinner"></div>';
    const tutorEmail = window.tutorData?.email;

    try {
        const q = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const snap = await getDocs(q);
        const students = snap.docs.map(d => d.data());

        if (type === 'individual') {
            container.innerHTML = `
                <select id="sel-recipient" class="form-input">
                    <option value="">Select Parent...</option>
                    ${students.map(s => `<option value="${s.parentPhone}" data-name="${s.parentName}">${s.parentName} (${s.studentName})</option>`).join('')}
                </select>
            `;
        } else if (type === 'group') {
            container.innerHTML = `
                <div class="checklist-box">
                    ${students.map(s => `
                        <label class="checklist-item">
                            <input type="checkbox" class="chk-recipient" value="${s.parentPhone}" data-name="${s.parentName}">
                            <span>${s.parentName} <small>(${s.studentName})</small></span>
                        </label>
                    `).join('')}
                </div>
            `;
        } else if (type === 'all') {
            container.innerHTML = `<div class="info-box">Sending to all ${students.length} parents.</div>`;
        } else {
            container.innerHTML = `<div class="info-box">Sending to Management/Admin.</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="error-box">Error loading students: ${e.message}</div>`;
    }
}

async function msgProcessSend(modal) {
    const type = modal.querySelector('.type-option.selected').dataset.type;
    const subject = modal.querySelector('#msg-subject').value;
    const content = modal.querySelector('#msg-content').value;
    const isUrgent = modal.querySelector('#msg-urgent').checked;
    const tutor = window.tutorData;

    if (!subject || !content) {
        alert("Please fill in subject and content.");
        return;
    }

    let targets = [];
    if (type === 'individual') {
        const sel = modal.querySelector('#sel-recipient');
        if (sel.value) targets.push({ phone: sel.value, name: sel.options[sel.selectedIndex].dataset.name });
    } else if (type === 'group') {
        modal.querySelectorAll('.chk-recipient:checked').forEach(c => {
            targets.push({ phone: c.value, name: c.dataset.name });
        });
    } else if (type === 'all') {
        const q = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
        const snap = await getDocs(q);
        const map = new Map();
        snap.forEach(d => {
            const s = d.data();
            map.set(s.parentPhone, s.parentName);
        });
        map.forEach((name, phone) => targets.push({ phone, name }));
    }

    if (targets.length === 0 && type !== 'management') {
        alert("No recipients selected.");
        return;
    }

    const btn = modal.querySelector('#btn-send-initial');
    btn.innerText = "Sending...";
    btn.disabled = true;
    
    try {
        for (const target of targets) {
            const convId = msgGenerateConvId(tutor.id, target.phone);
            const now = new Date(); 
            
            const convRef = doc(db, "conversations", convId);
            const convSnap = await getDoc(convRef); 
            
            let newCount = 1;
            if (convSnap.exists()) {
                const data = convSnap.data();
                newCount = (data.unreadCount || 0) + 1;
            }

            await setDoc(convRef, {
                participants: [tutor.id, target.phone],
                participantDetails: {
                    [tutor.id]: { name: tutor.name, role: 'tutor' },
                    [target.phone]: { name: target.name, role: 'parent' }
                },
                lastMessage: content,
                lastMessageTimestamp: now,
                lastSenderId: tutor.id,
                unreadCount: newCount
            }, { merge: true });

            await addDoc(collection(db, "conversations", convId, "messages"), {
                content: content,
                subject: subject,
                senderId: tutor.id,
                senderName: tutor.name,
                isUrgent: isUrgent,
                createdAt: now,
                read: false
            });
        }
        
        modal.remove();
        alert("Message Sent!");
    } catch (e) {
        console.error(e);
        alert("Error sending: " + e.message);
        btn.innerText = "Try Again";
        btn.disabled = false;
    }
}

// --- FEATURE 2: INBOX MODAL ---

function showInboxModal() {
    document.querySelectorAll('.inbox-modal').forEach(e => e.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay inbox-modal';
    modal.onclick = (e) => { if (e.target === modal) closeInbox(modal); };

    modal.innerHTML = `
        <div class="modal-content inbox-content">
            <button class="close-modal-absolute">&times;</button>
            <div class="inbox-container">
                <div class="inbox-list-col">
                    <div class="inbox-header">
                        <h4>Inbox</h4>
                        <button id="refresh-inbox" class="btn-icon">🔄</button>
                    </div>
                    <div id="inbox-list" class="inbox-list">
                        <div class="spinner"></div>
                    </div>
                </div>
                <div class="inbox-chat-col">
                    <div id="chat-view-header" class="chat-header hidden">
                        <div class="chat-title" id="chat-title">Select a chat</div>
                    </div>
                    <div id="chat-messages" class="chat-messages">
                        <div class="empty-state">Select a conversation</div>
                    </div>
                    <div id="chat-inputs" class="chat-inputs hidden">
                        <input type="text" id="chat-input-text" placeholder="Type a message...">
                        <button id="chat-send-btn">➤</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.close-modal-absolute').onclick = () => closeInbox(modal);
    msgStartInboxListener(modal);
}

function closeInbox(modal) {
    if (unsubInboxListener) unsubInboxListener();
    if (unsubChatListener) unsubChatListener();
    modal.remove();
}

function msgStartInboxListener(modal) {
    const tutorId = window.tutorData.id;
    const listEl = modal.querySelector('#inbox-list');
    
    if (unsubInboxListener) unsubInboxListener();

    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", tutorId)
    );

    unsubInboxListener = onSnapshot(q, (snapshot) => {
        const convs = [];
        snapshot.forEach(doc => convs.push({ id: doc.id, ...doc.data() }));

        convs.sort((a, b) => {
            const timeA = a.lastMessageTimestamp?.toDate ? a.lastMessageTimestamp.toDate() : new Date(a.lastMessageTimestamp || 0);
            const timeB = b.lastMessageTimestamp?.toDate ? b.lastMessageTimestamp.toDate() : new Date(b.lastMessageTimestamp || 0);
            return timeB - timeA; 
        });

        msgRenderInboxList(convs, listEl, modal, tutorId);
    });
}

function msgRenderInboxList(conversations, container, modal, tutorId) {
    container.innerHTML = '';
    
    if (conversations.length === 0) {
        container.innerHTML = '<div class="p-4 text-gray-500 text-center">No messages found.</div>';
        return;
    }

    conversations.forEach(conv => {
        const otherId = conv.participants.find(p => p !== tutorId);
        const otherName = conv.participantDetails?.[otherId]?.name || "Parent";
        const isUnread = conv.unreadCount > 0 && conv.lastSenderId !== tutorId;

        const el = document.createElement('div');
        el.className = `inbox-item ${isUnread ? 'unread' : ''}`;
        el.innerHTML = `
            <div class="avatar">${otherName.charAt(0)}</div>
            <div class="info">
                <div class="name">${msgEscapeHtml(otherName)}</div>
                <div class="preview">
                    ${conv.lastSenderId === tutorId ? 'You: ' : ''}${msgEscapeHtml(conv.lastMessage || '')}
                </div>
            </div>
            <div class="meta">
                <div class="time">${msgFormatTime(conv.lastMessageTimestamp)}</div>
                ${isUnread ? `<div class="badge">${conv.unreadCount}</div>` : ''}
            </div>
        `;
        el.onclick = () => msgLoadChat(conv.id, otherName, modal, tutorId);
        container.appendChild(el);
    });
}

function msgLoadChat(convId, name, modal, tutorId) {
    modal.querySelector('#chat-view-header').classList.remove('hidden');
    modal.querySelector('#chat-inputs').classList.remove('hidden');
    modal.querySelector('#chat-title').innerText = name;
    
    const msgContainer = modal.querySelector('#chat-messages');
    msgContainer.innerHTML = '<div class="spinner"></div>';

    updateDoc(doc(db, "conversations", convId), { unreadCount: 0 });

    if (unsubChatListener) unsubChatListener();

    const q = query(collection(db, "conversations", convId, "messages"));

    unsubChatListener = onSnapshot(q, (snapshot) => {
        let msgs = [];
        snapshot.forEach(doc => msgs.push(doc.data()));
        
        msgs.sort((a,b) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return tA - tB;
        });

        msgContainer.innerHTML = '';
        msgs.forEach(msg => {
            const isMe = msg.senderId === tutorId;
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${isMe ? 'me' : 'them'}`;
            bubble.innerHTML = `
                ${msg.subject ? `<strong>${msgEscapeHtml(msg.subject)}</strong><br>` : ''}
                ${msgEscapeHtml(msg.content)}
                <div class="timestamp">${msgFormatTime(msg.createdAt)}</div>
            `;
            msgContainer.appendChild(bubble);
        });
        msgContainer.scrollTop = msgContainer.scrollHeight;
    });

    const btn = modal.querySelector('#chat-send-btn');
    const input = modal.querySelector('#chat-input-text');
    
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.onclick = async () => {
        const txt = input.value.trim();
        if (!txt) return;
        input.value = '';

        const now = new Date();

        await addDoc(collection(db, "conversations", convId, "messages"), {
            content: txt,
            senderId: tutorId,
            createdAt: now,
            read: false
        });

        const convRef = doc(db, "conversations", convId);
        getDoc(convRef).then(snap => {
            const current = snap.exists() ? (snap.data().unreadCount || 0) : 0;
            updateDoc(convRef, {
                lastMessage: txt,
                lastMessageTimestamp: now,
                lastSenderId: tutorId,
                unreadCount: current + 1
            });
        });
    };
    
    input.onkeypress = (e) => { if (e.key === 'Enter') newBtn.click(); };
}

// --- CSS STYLES ---

function injectMessagingStyles() {
    if (document.getElementById('msg-styles')) return;
    const style = document.createElement('style');
    style.id = 'msg-styles';
    style.textContent = `
        .floating-messaging-btn, .floating-inbox-btn {
            position: fixed; bottom: 20px; right: 20px;
            background: linear-gradient(135deg, #6366f1, #4f46e5);
            color: white; border: none; border-radius: 50px;
            padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 9999; font-weight: bold;
        }
        .floating-inbox-btn { right: 140px; background: linear-gradient(135deg, #10b981, #059669); }
        .unread-badge {
            background: red; color: white; border-radius: 50%; width: 20px; height: 20px;
            font-size: 10px; display: flex; align-items: center; justify-content: center;
            position: absolute; top: -5px; right: -5px; border: 2px solid white;
        }

        .modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
            display: flex; justify-content: center; align-items: center; z-index: 10000;
        }
        .modal-content {
            background: white; border-radius: 12px; width: 90%; max-width: 800px;
            max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); position: relative;
        }
        .modal-header {
            padding: 15px; border-bottom: 1px solid #eee; display: flex; 
            justify-content: space-between; align-items: center; background: #f9fafb;
        }
        .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
        .modal-footer { padding: 15px; background: #f9fafb; display: flex; justify-content: flex-end; gap: 10px; }
        
        .close-modal-absolute { 
            position: absolute; top: 10px; right: 10px; font-size: 30px; 
            background: rgba(255,255,255,0.8); border: none; cursor: pointer; color: #333; z-index: 50;
            width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        
        .form-input { 
            width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; 
            margin-bottom: 10px; font-size: 14px;
        }
        .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-weight: 500; }
        .btn-primary { background: #4f46e5; color: white; }
        .btn-secondary { background: #e5e7eb; color: #374151; }
        .btn:disabled { opacity: 0.7; cursor: not-allowed; }
        
        .message-type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .type-option { 
            border: 2px solid #eee; border-radius: 8px; padding: 10px; text-align: center; cursor: pointer; 
            transition: 0.2s;
        }
        .type-option:hover, .type-option.selected { border-color: #4f46e5; background: #eef2ff; }
        .type-option .icon { font-size: 24px; margin-bottom: 5px; }
        
        .inbox-container { display: flex; height: 600px; max-height: 80vh; }
        .inbox-list-col { width: 35%; border-right: 1px solid #eee; display: flex; flex-direction: column; }
        .inbox-chat-col { width: 65%; display: flex; flex-direction: column; background: #f3f4f6; }
        
        .inbox-list { overflow-y: auto; flex: 1; }
        .inbox-item { 
            padding: 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer; display: flex; gap: 10px; 
            align-items: center; transition: 0.2s;
        }
        .inbox-item:hover { background: #f9fafb; }
        .inbox-item.unread { background: #eff6ff; }
        .inbox-item .avatar { 
            width: 40px; height: 40px; background: #ddd; border-radius: 50%; 
            display: flex; align-items: center; justify-content: center; font-weight: bold; color: white;
            background: linear-gradient(135deg, #a78bfa, #8b5cf6);
        }
        .inbox-item .info { flex: 1; overflow: hidden; }
        .inbox-item .name { font-weight: 600; font-size: 14px; }
        .inbox-item .preview { font-size: 12px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .inbox-item .meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .inbox-item .time { font-size: 10px; color: #9ca3af; }
        .inbox-item .badge { background: #ef4444; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; }

        .chat-messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .chat-bubble { max-width: 70%; padding: 10px 15px; border-radius: 12px; font-size: 14px; line-height: 1.4; position: relative; }
        .chat-bubble.me { align-self: flex-end; background: #4f46e5; color: white; border-bottom-right-radius: 2px; }
        .chat-bubble.them { align-self: flex-start; background: white; border: 1px solid #e5e7eb; border-bottom-left-radius: 2px; }
        .chat-bubble .timestamp { font-size: 9px; opacity: 0.7; text-align: right; margin-top: 4px; }
        
        .chat-inputs { padding: 15px; background: white; border-top: 1px solid #eee; display: flex; gap: 10px; }
        .chat-inputs input { flex: 1; padding: 10px; border-radius: 20px; border: 1px solid #ddd; outline: none; }
        .chat-inputs button { background: #4f46e5; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; }

        .hidden { display: none !important; }
        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #4f46e5; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 10px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
}

// --- AUTO-INIT ---
initializeFloatingMessagingButton();

/*******************************************************************************
 * SECTION 10: SCHEDULE CALENDAR VIEW
 ******************************************************************************/

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
                    <div id="calendar-view" class="hidden"></div>
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
    
    document.getElementById('print-calendar-btn').addEventListener('click', () => printCalendar());
    document.getElementById('edit-schedule-btn').addEventListener('click', () => {
        modal.remove();
        if (window.tutorData) checkAndShowSchedulePopup(window.tutorData);
    });
    document.getElementById('close-calendar-btn').addEventListener('click', () => modal.remove());
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
                </div>`;
        } else {
            renderCalendarView(studentsWithSchedule);
        }
        
        document.getElementById('calendar-loading').classList.add('hidden');
        document.getElementById('calendar-view').classList.remove('hidden');
        
    } catch (error) {
        console.error("Error loading calendar:", error);
    }
}

function renderCalendarView(students) {
    const scheduleByDay = {};
    DAYS_OF_WEEK.forEach(day => { scheduleByDay[day] = []; });
    
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
    
    let calendarHTML = `<div class="calendar-view">`;
    DAYS_OF_WEEK.forEach(day => {
        const dayEvents = scheduleByDay[day].sort((a,b) => a.start.localeCompare(b.start));
        calendarHTML += `
            <div class="calendar-day">
                <div class="calendar-day-header">${day}</div>
                <div class="calendar-day-events">
                    ${dayEvents.length === 0 ? '<div class="text-xs text-gray-400 text-center mt-4">No classes</div>' : 
                    dayEvents.map(event => `
                        <div class="calendar-event">
                            <div class="font-medium text-xs">${event.student}</div>
                            <div class="calendar-event-time">${event.time} ${event.isOvernight ? '🌙' : ''}</div>
                        </div>`).join('')}
                </div>
            </div>`;
    });
    calendarHTML += `</div>`;
    document.getElementById('calendar-view').innerHTML = calendarHTML;
}

function printCalendar() {
    const calendarContent = document.getElementById('calendar-view').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Weekly Schedule Calendar</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .calendar-view { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
                    .calendar-day { border: 1px solid #ddd; padding: 10px; min-height: 120px; }
                    .calendar-day-header { font-weight: bold; border-bottom: 1px solid #ddd; margin-bottom: 5px; }
                    .calendar-event { background: #f5f5f5; padding: 5px; margin-bottom: 3px; font-size: 11px; }
                </style>
            </head>
            <body>
                <h2>Weekly Schedule Calendar</h2>
                <p>Tutor: ${window.tutorData.name}</p>
                <hr>
                ${calendarContent}
                <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }</script>
            </body>
        </html>`);
}

/*******************************************************************************
 * SECTION 11: TUTOR DASHBOARD
 ******************************************************************************/

let studentCache = [];

function renderTutorDashboard(container, tutor) {
    updateActiveTab('navDashboard');
    
    container.innerHTML = `
        <div class="hero-section">
            <h1 class="hero-title">Welcome, ${tutor.name || 'Tutor'}! 👋</h1>
            <p class="hero-subtitle">Manage your students, submit reports, and track progress</p>
        </div>
        
        <div class="student-actions-container">
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📅 Schedule Management</h3>
                <button id="view-full-calendar-btn" class="btn btn-info w-full mb-2">View Schedule Calendar</button>
                <button id="setup-all-schedules-btn" class="btn btn-primary w-full">Set Up Schedules</button>
            </div>
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📚 Today's Topic</h3>
                <select id="select-student-topic" class="form-input mb-3"><option value="">Select a student...</option></select>
                <button id="add-topic-btn" class="btn btn-secondary w-full" disabled>Add Today's Topic</button>
            </div>
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📝 Assign Homework</h3>
                <select id="select-student-hw" class="form-input mb-3"><option value="">Select a student...</option></select>
                <button id="assign-hw-btn" class="btn btn-warning w-full" disabled>Assign Homework</button>
            </div>
        </div>
        
        <div class="card mt-6">
            <div class="card-header"><h3 class="font-bold text-lg">🔍 Pending Assessments</h3></div>
            <div id="pendingReportsContainer" class="card-body">
                <div class="spinner mx-auto"></div>
            </div>
        </div>`;

    loadStudentDropdowns(tutor.email);

    document.getElementById('view-full-calendar-btn').onclick = showScheduleCalendarModal;
    document.getElementById('setup-all-schedules-btn').onclick = () => checkAndShowSchedulePopup(tutor);
    
    const topicSelect = document.getElementById('select-student-topic');
    topicSelect.onchange = (e) => document.getElementById('add-topic-btn').disabled = !e.target.value;
    document.getElementById('add-topic-btn').onclick = () => {
        const student = getStudentFromCache(topicSelect.value);
        if (student) showDailyTopicModal(student);
    };

    const hwSelect = document.getElementById('select-student-hw');
    hwSelect.onchange = (e) => document.getElementById('assign-hw-btn').disabled = !e.target.value;
    document.getElementById('assign-hw-btn').onclick = () => {
        const student = getStudentFromCache(hwSelect.value);
        if (student) showHomeworkModal(student);
    };

    loadTutorReports(tutor.email);
}

async function loadStudentDropdowns(tutorEmail) {
    try {
        const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const studentsSnapshot = await getDocs(studentsQuery);
        studentCache = [];
        const topicSelect = document.getElementById('select-student-topic');
        const hwSelect = document.getElementById('select-student-hw');
        
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            if (!['archived', 'graduated', 'transferred'].includes(student.status)) {
                studentCache.push(student);
                const opt = document.createElement('option');
                opt.value = student.id; opt.textContent = `${student.studentName} (${student.grade})`;
                topicSelect.appendChild(opt);
                hwSelect.appendChild(opt.cloneNode(true));
            }
        });
    } catch (e) { console.error(e); }
}

function getStudentFromCache(studentId) { return studentCache.find(s => s.id === studentId); }

async function loadTutorReports(tutorEmail) {
    const container = document.getElementById('pendingReportsContainer');
    try {
        const q = query(collection(db, "student_results"), where("tutorEmail", "==", tutorEmail));
        const snap = await getDocs(q);
        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            html += `<div class="p-4 border rounded mb-2 flex justify-between items-center">
                <div><strong>${data.studentName}</strong> - ${data.testSubject || 'Test'}</div>
                <button class="btn btn-sm btn-primary">Review</button>
            </div>`;
        });
        container.innerHTML = html || '<p class="text-gray-500">No pending assessments.</p>';
    } catch (e) { container.innerHTML = 'Error loading reports.'; }
}

/*******************************************************************************
 * SECTION 12: STUDENT DATABASE & REPORT SUBMISSION (REFACTORED)
 ******************************************************************************/

async function renderStudentDatabase(container, tutor) {
    updateActiveTab('navStudentDatabase');
    
    let savedReports = await loadReportsFromFirestore(tutor.email);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Fetch Students
    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const studentsSnap = await getDocs(studentQuery);
    
    // 2. Fetch submissions to check if already submitted this month
    const submissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutor.email));
    const subSnap = await getDocs(submissionsQuery);
    const submittedIds = new Set();
    subSnap.forEach(d => {
        const date = d.data().submittedAt.toDate();
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            submittedIds.add(d.data().studentId);
        }
    });

    const approvedStudents = studentsSnap.docs
        .map(d => ({ id: d.id, ...d.data(), collection: "students" }))
        .filter(s => !['archived', 'graduated', 'transferred'].includes(s.status));

    let html = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-800">📚 My Students (${approvedStudents.length})</h2>
        </div>
        <div class="table-container">
            <table class="table">
                <thead><tr><th>Student</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>`;

    approvedStudents.forEach(student => {
        const hasSubmitted = submittedIds.has(student.id);
        const isReportSaved = savedReports[student.id];
        const isTransitioning = student.isTransitioning;

        let statusBadge = hasSubmitted ? '<span class="badge badge-info">📤 Sent</span>' : 
                          (isReportSaved ? '<span class="badge badge-success">💾 Saved</span>' : '<span class="badge badge-secondary">📝 Pending</span>');
        
        if (isTransitioning) statusBadge += ' <span class="badge badge-warning ml-1">🔄 Trans.</span>';

        let actionBtn = '';
        if (hasSubmitted) {
            actionBtn = '<span class="text-xs text-gray-400">Done for this month</span>';
        } else {
            actionBtn = `<button class="btn btn-primary btn-sm enter-report-btn" data-id="${student.id}">${isReportSaved ? 'Edit' : 'Enter'} Report</button>`;
        }

        html += `
            <tr>
                <td><strong>${student.studentName}</strong><br><small>${student.grade}</small></td>
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            </tr>`;
    });

    html += `</tbody></table></div>`;

    // Bulk Submission Button
    const submittable = approvedStudents.filter(s => !submittedIds.has(s.id));
    const savedCount = Object.keys(savedReports).length;
    if (submittable.length > 0) {
        html += `
            <div class="mt-6 p-4 bg-gray-50 rounded flex justify-between items-center">
                <span class="text-sm font-medium">${savedCount} of ${submittable.length} reports ready.</span>
                <button id="submit-all-reports-btn" class="btn btn-primary" ${savedCount === 0 ? 'disabled' : ''}>
                    Submit All Prepared Reports
                </button>
            </div>`;
    }

    container.innerHTML = html;

    // --- BUTTON LOGIC ---

    // Enter Report
    container.querySelectorAll('.enter-report-btn').forEach(btn => {
        btn.onclick = () => {
            const student = approvedStudents.find(s => s.id === btn.dataset.id);
            if (student.isTransitioning) {
                // Skip report, go to Fee
                showFeeConfirmationModal(student, { isTransitioning: true }, savedReports, tutor, container);
            } else {
                showReportModal(student, savedReports, tutor, container);
            }
        };
    });

    // Bulk Submit
    const bulkBtn = document.getElementById('submit-all-reports-btn');
    if (bulkBtn) {
        bulkBtn.onclick = () => showAccountDetailsModal(Object.values(savedReports), tutor, container);
    }
}

// ==========================================
// REPORT & FEE MODALS (CORE IMPLEMENTATION)
// ==========================================

function showReportModal(student, savedReports, tutor, container) {
    const existing = savedReports[student.id] || {};
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content max-w-4xl">
            <div class="modal-header"><h3 class="modal-title">📝 Report: ${student.studentName}</h3></div>
            <div class="modal-body space-y-4">
                <div class="form-group"><label class="form-label">Introduction</label><textarea id="rep-intro" class="form-input" rows="2">${existing.introduction || ''}</textarea></div>
                <div class="form-group"><label class="form-label">Topics Covered</label><textarea id="rep-topics" class="form-input" rows="3">${existing.topics || ''}</textarea></div>
                <div class="form-group"><label class="form-label">Progress</label><textarea id="rep-progress" class="form-input" rows="2">${existing.progress || ''}</textarea></div>
                <div class="form-group"><label class="form-label">Strengths/Weaknesses</label><textarea id="rep-sw" class="form-input" rows="2">${existing.strengthsWeaknesses || ''}</textarea></div>
                <div class="form-group"><label class="form-label">Recommendations</label><textarea id="rep-recs" class="form-input" rows="2">${existing.recommendations || ''}</textarea></div>
                <div class="form-group"><label class="form-label">General Comments</label><textarea id="rep-general" class="form-input" rows="2">${existing.generalComments || ''}</textarea></div>
            </div>
            <div class="modal-footer">
                <button id="cancel-rep" class="btn btn-secondary">Cancel</button>
                <button id="next-to-fee" class="btn btn-primary">Save & Continue to Fee</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById('cancel-rep').onclick = () => modal.remove();
    document.getElementById('next-to-fee').onclick = () => {
        const reportData = {
            studentId: student.id, studentName: student.studentName, grade: student.grade,
            parentName: student.parentName, parentPhone: student.parentPhone,
            reportMonth: getCurrentMonthYear(),
            introduction: document.getElementById('rep-intro').value,
            topics: document.getElementById('rep-topics').value,
            progress: document.getElementById('rep-progress').value,
            strengthsWeaknesses: document.getElementById('rep-sw').value,
            recommendations: document.getElementById('rep-recs').value,
            generalComments: document.getElementById('rep-general').value
        };
        modal.remove();
        showFeeConfirmationModal(student, reportData, savedReports, tutor, container);
    };
}

function showFeeConfirmationModal(student, reportData, savedReports, tutor, container) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content max-w-md">
            <div class="modal-header"><h3 class="modal-title">💰 Confirm Fee: ${student.studentName}</h3></div>
            <div class="modal-body">
                <p class="text-sm text-gray-600 mb-4">Verify the monthly fee for this student. If it has changed, update it here.</p>
                <div class="form-group">
                    <label class="form-label">Monthly Fee (₦)</label>
                    <input type="number" id="conf-fee" class="form-input" value="${student.studentFee || 0}">
                </div>
            </div>
            <div class="modal-footer">
                <button id="conf-fee-cancel" class="btn btn-secondary">Back</button>
                <button id="conf-fee-save" class="btn btn-primary">Save Prepared Report</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById('conf-fee-cancel').onclick = () => {
        modal.remove();
        if (!reportData.isTransitioning) showReportModal(student, savedReports, tutor, container);
    };

    document.getElementById('conf-fee-save').onclick = async () => {
        const newFee = parseFloat(document.getElementById('conf-fee').value);
        if (isNaN(newFee)) return showCustomAlert("Invalid Fee");

        // Sync to DB if changed
        if (newFee !== student.studentFee) {
            await updateDoc(doc(db, "students", student.id), { studentFee: newFee });
            student.studentFee = newFee;
        }

        savedReports[student.id] = reportData;
        await saveReportsToFirestore(tutor.email, savedReports);
        modal.remove();
        showCustomAlert("✅ Report Prepared and Saved!");
        renderStudentDatabase(container, tutor);
    };
}

function showAccountDetailsModal(reportsArray, tutor, container) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content max-w-md">
            <div class="modal-header"><h3 class="modal-title">🏦 Bank Details</h3></div>
            <div class="modal-body space-y-4">
                <div class="form-group"><label class="form-label">Bank Name</label><input type="text" id="acc-bank" class="form-input" placeholder="e.g. Kuda" required></div>
                <div class="form-group"><label class="form-label">Account Number</label><input type="text" id="acc-num" class="form-input" placeholder="10 digits" required></div>
                <div class="form-group"><label class="form-label">Account Name</label><input type="text" id="acc-name" class="form-input" placeholder="Full name" required></div>
            </div>
            <div class="modal-footer">
                <button id="acc-cancel" class="btn btn-secondary">Cancel</button>
                <button id="acc-submit" class="btn btn-primary">Confirm & Submit All</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById('acc-cancel').onclick = () => modal.remove();
    document.getElementById('acc-submit').onclick = async () => {
        const bank = document.getElementById('acc-bank').value.trim();
        const num = document.getElementById('acc-num').value.trim();
        const name = document.getElementById('acc-name').value.trim();

        if (!bank || !num || !name) return showCustomAlert("Fill all bank details");

        const btn = document.getElementById('acc-submit');
        btn.disabled = true; btn.innerText = "Submitting...";

        try {
            const batch = writeBatch(db);
            reportsArray.forEach(report => {
                const ref = doc(collection(db, "tutor_submissions"));
                batch.set(ref, {
                    ...report, tutorEmail: tutor.email, tutorName: tutor.name,
                    submittedAt: new Date(), beneficiaryBank: bank,
                    beneficiaryAccount: num, beneficiaryName: name,
                    normalizedParentPhone: normalizePhoneNumber(report.parentPhone)
                });
            });
            await batch.commit();
            await clearAllReportsFromFirestore(tutor.email);
            modal.remove();
            showCustomAlert(`✅ Successfully submitted ${reportsArray.length} report(s)!`);
            renderStudentDatabase(container, tutor);
        } catch (e) {
            console.error(e);
            showCustomAlert("Submission Error");
            btn.disabled = false; btn.innerText = "Try Again";
        }
    };
}

/*******************************************************************************
 * SECTION 13: AUTO-REGISTERED STUDENTS
 ******************************************************************************/

function renderAutoRegisteredStudents(container, tutor) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header"><h2 class="text-2xl font-bold">🆕 Auto-Registered Students</h2></div>
            <div id="auto-students-list" class="card-body"><div class="spinner mx-auto"></div></div>
        </div>`;
    loadAutoRegisteredStudents(tutor.email);
}

async function loadAutoRegisteredStudents(tutorEmail) {
    const q = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail), where("autoRegistered", "==", true));
    const snap = await getDocs(q);
    const container = document.getElementById('auto-students-list');
    
    if (snap.empty) {
        container.innerHTML = '<p class="text-center text-gray-500">No new auto-registrations.</p>';
        return;
    }

    let html = '<div class="table-container"><table class="table"><thead><tr><th>Student</th><th>Action</th></tr></thead><tbody>';
    snap.forEach(d => {
        const s = d.data();
        html += `<tr><td>${s.studentName}<br><small>${s.grade}</small></td><td><button class="btn btn-sm btn-primary compl-btn" data-id="${d.id}">Complete Profile</button></td></tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;

    container.querySelectorAll('.compl-btn').forEach(btn => {
        btn.onclick = () => {
            const student = snap.docs.find(d => d.id === btn.dataset.id).data();
            student.id = btn.dataset.id; student.collection = "students";
            showEditStudentModal(student);
        };
    });
}

/*******************************************************************************
 * SECTION 14: AUTH & INITIALIZATION
 ******************************************************************************/

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const q = query(collection(db, "tutors"), where("email", "==", user.email.trim()));
            const snap = await getDocs(q);
            if (!snap.empty) {
                window.tutorData = { id: snap.docs[0].id, ...snap.docs[0].data() };
                renderTutorDashboard(document.getElementById('mainContent'), window.tutorData);
                initializeFloatingMessagingButton();
                setInterval(updateUnreadMessageCount, 60000);
            } else {
                window.location.href = 'tutor-auth.html';
            }
        } else {
            window.location.href = 'tutor-auth.html';
        }
    });

    document.getElementById('navDashboard').onclick = () => renderTutorDashboard(document.getElementById('mainContent'), window.tutorData);
    document.getElementById('navStudentDatabase').onclick = () => renderStudentDatabase(document.getElementById('mainContent'), window.tutorData);
    document.getElementById('navAutoStudents').onclick = () => renderAutoRegisteredStudents(document.getElementById('mainContent'), window.tutorData);
    
    document.getElementById('logoutBtn').onclick = () => signOut(auth).then(() => window.location.href = 'tutor-auth.html');
});
