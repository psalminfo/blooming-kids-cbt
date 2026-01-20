[file name]: tutor.js
[file content begin]
/*******************************************************************************
 * SECTION 1: IMPORTS & INITIAL SETUP
 ******************************************************************************/

import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/*******************************************************************************
 * SECTION 2: STYLES & CSS (UPDATED WITH MODAL POSITIONING FIX)
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

    /* Fixed positioning for modals */
    .fixed {
        position: fixed !important;
    }

    .inset-0 {
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        left: 0 !important;
    }

    .bg-gray-600 {
        background-color: #4b5563 !important;
    }

    .bg-opacity-50 {
        opacity: 0.5 !important;
    }

    .overflow-y-auto {
        overflow-y: auto !important;
    }

    .h-full {
        height: 100% !important;
    }

    .w-full {
        width: 100% !important;
    }

    .flex {
        display: flex !important;
    }

    .items-center {
        align-items: center !important;
    }

    .justify-center {
        justify-content: center !important;
    }

    .z-50 {
        z-index: 50 !important;
    }

    /* Modal content styling */
    .relative {
        position: relative !important;
    }

    .bg-white {
        background-color: #ffffff !important;
    }

    .p-8 {
        padding: 2rem !important;
    }

    .rounded-lg {
        border-radius: 0.5rem !important;
    }

    .shadow-xl {
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
    }

    .max-w-2xl {
        max-width: 42rem !important;
    }

    .max-w-md {
        max-width: 28rem !important;
    }

    .max-w-lg {
        max-width: 32rem !important;
    }

    .mx-auto {
        margin-left: auto !important;
        margin-right: auto !important;
    }

    /* Text styling */
    .text-xl {
        font-size: 1.25rem !important;
        line-height: 1.75rem !important;
    }

    .font-bold {
        font-weight: 700 !important;
    }

    .mb-4 {
        margin-bottom: 1rem !important;
    }

    .text-green-700 {
        color: #047857 !important;
    }

    .text-blue-800 {
        color: #1e40af !important;
    }

    .text-blue-700 {
        color: #1d4ed8 !important;
    }

    .text-gray-600 {
        color: #4b5563 !important;
    }

    .text-sm {
        font-size: 0.875rem !important;
        line-height: 1.25rem !important;
    }

    .text-gray-500 {
        color: #6b7280 !important;
    }

    .font-semibold {
        font-weight: 600 !important;
    }

    .text-lg {
        font-size: 1.125rem !important;
        line-height: 1.75rem !important;
    }

    .text-blue-600 {
        color: #2563eb !important;
    }

    .text-xs {
        font-size: 0.75rem !important;
        line-height: 1rem !important;
    }

    /* Form elements */
    .space-y-4 > * + * {
        margin-top: 1rem !important;
    }

    .mt-1 {
        margin-top: 0.25rem !important;
    }

    .p-2 {
        padding: 0.5rem !important;
    }

    .border {
        border-width: 1px !important;
        border-style: solid !important;
    }

    .rounded {
        border-radius: 0.25rem !important;
    }

    /* Button styling */
    .bg-green-600 {
        background-color: #059669 !important;
    }

    .bg-gray-500 {
        background-color: #6b7280 !important;
    }

    .bg-red-500 {
        background-color: #ef4444 !important;
    }

    .text-white {
        color: #ffffff !important;
    }

    .px-6 {
        padding-left: 1.5rem !important;
        padding-right: 1.5rem !important;
    }

    .py-2 {
        padding-top: 0.5rem !important;
        padding-bottom: 0.5rem !important;
    }

    .hover\\:bg-green-700:hover {
        background-color: #047857 !important;
    }

    .hover\\:bg-gray-700:hover {
        background-color: #374151 !important;
    }

    .float-right {
        float: right !important;
    }

    /* Background colors */
    .bg-blue-50 {
        background-color: #eff6ff !important;
    }

    .bg-green-50 {
        background-color: #f0fdf4 !important;
    }

    .bg-red-50 {
        background-color: #fef2f2 !important;
    }

    .bg-orange-50 {
        background-color: #fff7ed !important;
    }

    /* Border colors */
    .border-red-400 {
        border-color: #f87171 !important;
    }

    .border-l-4 {
        border-left-width: 4px !important;
    }

    /* Status indicators */
    .bg-orange-100 {
        background-color: #ffedd5 !important;
    }

    .text-orange-800 {
        color: #9a3412 !important;
    }

    .px-2 {
        padding-left: 0.5rem !important;
        padding-right: 0.5rem !important;
    }

    .py-1 {
        padding-top: 0.25rem !important;
        padding-bottom: 0.25rem !important;
    }

    .rounded-full {
        border-radius: 9999px !important;
    }

    /* Flex utilities */
    .justify-end {
        justify-content: flex-end !important;
    }

    .space-x-2 > * + * {
        margin-left: 0.5rem !important;
    }

    .mt-6 {
        margin-top: 1.5rem !important;
    }

    /* Alert/notification colors */
    .text-red-500 {
        color: #ef4444 !important;
    }

    .text-green-600 {
        color: #059669 !important;
    }

    /* List styling */
    .list-disc {
        list-style-type: disc !important;
    }

    .pl-5 {
        padding-left: 1.25rem !important;
    }

    /* Special modal colors */
    .text-orange-600 {
        color: #ea580c !important;
    }

    /* SVG icons */
    .h-6 {
        height: 1.5rem !important;
    }

    .w-6 {
        width: 1.5rem !important;
    }

    .text-red-600 {
        color: #dc2626 !important;
    }

    .ml-3 {
        margin-left: 0.75rem !important;
    }

    /* Animation for processing */
    .animate-spin {
        animation: spin 1s linear infinite !important;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .h-12 {
        height: 3rem !important;
    }

    .w-12 {
        width: 3rem !important;
    }

    .border-b-2 {
        border-bottom-width: 2px !important;
    }

    /* Validation styles */
    .border-red-300 {
        border-color: #fca5a5 !important;
    }

    .border-green-300 {
        border-color: #86efac !important;
    }

    .border-red-500 {
        border-color: #ef4444 !important;
    }

    .border-green-500 {
        border-color: #22c55e !important;
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
    // Add late night/overnight slots if needed (e.g., up to 2 AM)
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
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
                <div class="modal-header">
                    <h3 class="text-xl font-bold mb-4">📅 Set Schedule for ${student.studentName}</h3>
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
            // But wait... if we delete their schedule, they technically go back to "unscheduled" list?
            // User flow: If I delete it, I probably want to skip them for now.
            
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
            const validation = validateScheduleTime(start, end); // Assumes this helper exists globally or in prev section
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
            }, { merge: true }); // Merge ensures we don't overwrite other fields if they exist
            
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
        
        // If we marked as scheduled, the list is now 1 shorter, so index 0 is the next guy.
        // If we skipped, we incremented index, so we look at the new index.
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
 * (Version: Auto-Sync Parent Data & "Self-Healing" Database)
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
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-lg bg-white">
                <div class="modal-header">
                    <h3 class="text-xl font-bold mb-4">📚 Daily Topic: ${student.studentName}</h3>
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
// HELPER FUNCTIONS FOR EDITING (UNCHANGED)
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
                html += `<li class="flex flex-col border-b border-blue-100 last:border-0 pb-2">`;
            }
        });
        html += '</ul>';
        container.innerHTML = count > 0 ? html : '<p class="text-center text-gray-500 italic">No topics yet.</p>';
        document.getElementById('topic-history-container').classList.remove('hidden');
        document.getElementById('topic-count-badge').textContent = count;
    } catch (e) { console.error(e); container.innerHTML = '<p class="text-red-500">Error loading history.</p>'; }
}

// ==========================================
// 2. HOMEWORK ASSIGNMENT (SMART SYNC VERSION)
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

// *** NEW: Returns object { email, name } instead of just email
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
            // Return both name and email
            return { 
                email: data.email, 
                name: data.fullName || data.name || data.parentName || "Parent" // Handle various naming conventions
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

    // Check if we already have data in the Student object
    let currentParentName = student.parentName || "Loading...";
    let currentParentEmail = student.parentEmail || "Searching...";
    const parentPhone = student.parentPhone || "Not Found";

    const modalHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
                <div class="modal-header"><h3 class="text-xl font-bold mb-4">📝 Assign Homework for ${student.studentName}</h3></div>
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

    // *** AUTO-FETCH LOGIC: Runs immediately if data is missing ***
    let fetchedParentData = null;

    if (student.parentPhone && (!student.parentEmail || !student.parentName)) {
        fetchParentDataByPhone(student.parentPhone).then(data => {
            if (data) {
                fetchedParentData = data;
                // Update UI Live
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
        // Data already exists, just clear the "Searching..." text if needed
        if(student.parentName) document.getElementById('display-parent-name').textContent = student.parentName;
        if(student.parentEmail) document.getElementById('display-parent-email').textContent = student.parentEmail;
    }

    // File Handling (Standard)
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

    // SAVE LOGIC
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
            
            // --- STEP 1: RESOLVE PARENT DATA ---
            // Priority: 1. Fetched just now (new), 2. Existing on student, 3. Empty
            let finalParentEmail = fetchedParentData?.email || student.parentEmail || "";
            let finalParentName = fetchedParentData?.name || student.parentName || "";

            // If we still don't have it, try one last desperate fetch
            if (sendEmail && !finalParentEmail && student.parentPhone) {
                saveBtn.innerHTML = "🔍 Finalizing Parent Info...";
                const lastCheck = await fetchParentDataByPhone(student.parentPhone);
                if (lastCheck) {
                    finalParentEmail = lastCheck.email;
                    finalParentName = lastCheck.name;
                    fetchedParentData = lastCheck; // Mark as new so we save it below
                }
            }

            // *** CRITICAL UPDATE: SYNC TO STUDENTS COLLECTION ***
            // If we found new data that wasn't there before, update the student record permanently.
            if (fetchedParentData) {
                saveBtn.innerHTML = "💾 Syncing Student Data...";
                try {
                    await updateDoc(doc(db, "students", student.id), {
                        parentEmail: finalParentEmail,
                        parentName: finalParentName
                    });
                    console.log("Student record updated with new parent info.");
                } catch (updateError) {
                    console.error("Failed to sync student data (non-fatal):", updateError);
                }
            }

            // --- STEP 2: UPLOAD FILES ---
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

            // --- STEP 3: SAVE TO FIREBASE ---
            saveBtn.innerHTML = "Saving...";
            const newHwRef = doc(collection(db, "homework_assignments"));
            
            const hwData = {
                id: newHwRef.id,
                studentId: student.id,
                studentName: student.studentName,
                parentEmail: finalParentEmail,
                parentName: finalParentName, // Now storing Name in HW record too
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

            // --- STEP 4: SEND EMAIL ---
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
 * SECTION 9: MESSAGING & INBOX FEATURES (CRASH-PROOF EDITION)
 * * CRITICAL FIXES:
 * - Removed 'serverTimestamp' dependency. Now uses native 'new Date()'.
 * - Removed 'increment' dependency. Now uses manual count updates.
 * - This resolves the "invalid data / custom object" error permanently.
 ******************************************************************************/

// --- STATE MANAGEMENT ---
let msgSectionUnreadCount = 0;
let btnFloatingMsg = null;
let btnFloatingInbox = null;

// --- LISTENERS (Memory Management) ---
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
    // Handle Firestore Timestamp vs JS Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return ''; // Invalid date check
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- INITIALIZATION ---

function initializeFloatingMessagingButton() {
    // 1. Clean up old buttons
    const oldBtns = document.querySelectorAll('.floating-messaging-btn, .floating-inbox-btn');
    oldBtns.forEach(btn => btn.remove());
    
    // 2. Create Messaging Button
    btnFloatingMsg = document.createElement('button');
    btnFloatingMsg.className = 'floating-messaging-btn';
    btnFloatingMsg.innerHTML = `<span class="floating-btn-icon">💬</span><span class="floating-btn-text">New</span>`;
    btnFloatingMsg.onclick = showEnhancedMessagingModal;
    
    // 3. Create Inbox Button
    btnFloatingInbox = document.createElement('button');
    btnFloatingInbox.className = 'floating-inbox-btn';
    btnFloatingInbox.innerHTML = `<span class="floating-btn-icon">📨</span><span class="floating-btn-text">Inbox</span>`;
    btnFloatingInbox.onclick = showInboxModal;
    
    // 4. Mount to DOM
    document.body.appendChild(btnFloatingMsg);
    document.body.appendChild(btnFloatingInbox);
    
    // 5. Inject CSS
    injectMessagingStyles();
    
    // 6. Start Listener
    if (window.tutorData && window.tutorData.id) {
        initializeUnreadListener();
    } else {
        setTimeout(() => {
            if (window.tutorData && window.tutorData.id) initializeUnreadListener();
        }, 3000);
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
            // Count unread if I am NOT the last sender
            if (data.unreadCount > 0 && data.lastSenderId !== tutorId) {
                count += data.unreadCount;
            }
        });
        
        msgSectionUnreadCount = count;
        updateFloatingBadges();
    });
}

// Compatibility Alias
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
        // Send loop
        for (const target of targets) {
            const convId = msgGenerateConvId(tutor.id, target.phone);
            const now = new Date(); // USE NATIVE DATE
            
            // Manual Increment Logic: Read -> Calculate -> Write
            const convRef = doc(db, "conversations", convId);
            const convSnap = await getDoc(convRef); // New dependency: getDoc (usually available)
            
            let newCount = 1;
            if (convSnap.exists()) {
                const data = convSnap.data();
                // If the last sender was me, reset count. If not, increment.
                // Logic: I am sending now, so for the RECIPIENT, it increments.
                // But since I am the tutor, and I'm sending to Parent, I want to update THEIR unread count?
                // Actually, this unreadCount field is shared. A better schema splits it, but for now:
                // We just increment it.
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
        // Fallback if getDoc is missing, try blind write
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

        // 1. Send Message
        await addDoc(collection(db, "conversations", convId, "messages"), {
            content: txt,
            senderId: tutorId,
            createdAt: now,
            read: false
        });

        // 2. Manual Increment for Metadata
        const convRef = doc(db, "conversations", convId);
        // We do a quick read to get current count to be safe
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
        /* --- Floating Buttons --- */
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

        /* --- Modals --- */
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
        
        /* --- Inputs --- */
        .form-input { 
            width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; 
            margin-bottom: 10px; font-size: 14px;
        }
        .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-weight: 500; }
        .btn-primary { background: #4f46e5; color: white; }
        .btn-secondary { background: #e5e7eb; color: #374151; }
        .btn:disabled { opacity: 0.7; cursor: not-allowed; }
        
        /* --- Messaging Specific --- */
        .message-type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .type-option { 
            border: 2px solid #eee; border-radius: 8px; padding: 10px; text-align: center; cursor: pointer; 
            transition: 0.2s;
        }
        .type-option:hover, .type-option.selected { border-color: #4f46e5; background: #eef2ff; }
        .type-option .icon { font-size: 24px; margin-bottom: 5px; }
        
        /* --- Inbox Specific --- */
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
        
        @media(max-width: 640px) {
            .inbox-list-col { width: 100%; }
            .inbox-chat-col { display: none; }
            .inbox-container.chat-active .inbox-list-col { display: none; }
            .inbox-container.chat-active .inbox-chat-col { display: flex; width: 100%; }
            .message-type-grid { grid-template-columns: repeat(2, 1fr); }
        }
    `;
    document.head.appendChild(style);
}

// --- AUTO-INIT ---
initializeFloatingMessagingButton();

/*******************************************************************************
 * SECTION 10: SCHEDULE CALENDAR VIEW
 ******************************************************************************/

// View Schedule Calendar for All Students
function showScheduleCalendarModal() {
    const modalHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative mx-auto p-5 border w-full max-w-6xl shadow-lg rounded-lg bg-white">
                <div class="modal-header">
                    <h3 class="text-xl font-bold mb-4">📅 Weekly Schedule Calendar</h3>
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

// Edit Schedule Modal
function showEditScheduleModal(student) {
    const modalHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
                <div class="modal-header">
                    <h3 class="text-xl font-bold mb-4">✏️ Edit Schedule for ${student.studentName}</h3>
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
                            </div>`}
                    </div>
                    
                    <button id="add-schedule-entry" class="btn btn-secondary btn-sm mt-2">
                        ＋ Add Another Time Slot
                    </button>
                </div>
                <div class="modal-footer">
                    <button id="cancel-edit-schedule-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-edit-schedule-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Save Schedule
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
        const firstEntry = scheduleEntries.querySelector('.schedule-entry');
        const newEntry = firstEntry.cloneNode(true);
        // Reset values for new entry
        newEntry.querySelector('.schedule-day').selectedIndex = 0;
        newEntry.querySelector('.schedule-start').selectedIndex = 0;
        newEntry.querySelector('.schedule-end').selectedIndex = 0;
        newEntry.querySelector('.remove-schedule-btn').classList.remove('hidden');
        scheduleEntries.appendChild(newEntry);
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-schedule-btn')) {
            const scheduleEntries = document.querySelectorAll('.schedule-entry');
            if (scheduleEntries.length > 1) {
                e.target.closest('.schedule-entry').remove();
            } else {
                showCustomAlert('You must have at least one schedule entry.');
            }
        }
    });
    
    document.getElementById('cancel-edit-schedule-btn').addEventListener('click', () => {
        modal.remove();
        showScheduleCalendarModal();
    });
    
    document.getElementById('save-edit-schedule-btn').addEventListener('click', async () => {
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
            
            modal.remove();
            showCustomAlert('✅ Schedule updated successfully!');
            
            setTimeout(() => {
                showScheduleCalendarModal();
            }, 500);
            
        } catch (error) {
            console.error("Error updating schedule:", error);
            showCustomAlert('❌ Error updating schedule. Please try again.');
        }
    });
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
                    .edit-schedule-btn { display: none; }
                    @media print { body { font-size: 12px; } }
                </style>
            </head>
            <body>
                <h2>Weekly Schedule Calendar</h2>
                <p>Tutor: ${window.tutorData.name}</p>
                <p>Generated on: ${new Date().toLocaleDateString()}</p>
                <hr>
                ${calendarContent}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    }
                </script>
            </body>
        </html>
    `);
}

/*******************************************************************************
 * SECTION 11: TUTOR DASHBOARD
 ******************************************************************************/

// Cache for students
let studentCache = [];

// Enhanced Tutor Dashboard - WITH MESSAGING & INBOX FEATURES
function renderTutorDashboard(container, tutor) {
    // Update active tab
    updateActiveTab('navDashboard');
    
    container.innerHTML = `
        <div class="hero-section">
            <h1 class="hero-title">Welcome, ${tutor.name || 'Tutor'}! 👋</h1>
            <p class="hero-subtitle">Manage your students, submit reports, and track progress</p>
        </div>
        
        <div class="student-actions-container">
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📅 Schedule Management</h3>
                <p class="text-sm text-gray-600 mb-4">Set up and view class schedules for all students</p>
                <button id="view-full-calendar-btn" class="btn btn-info w-full mb-2">View Schedule Calendar</button>
                <button id="setup-all-schedules-btn" class="btn btn-primary w-full">Set Up Schedules</button>
            </div>
            
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📚 Today's Topic</h3>
                <p class="text-sm text-gray-600 mb-4">Record topics covered in today's classes</p>
                <select id="select-student-topic" class="form-input mb-3">
                    <option value="">Select a student...</option>
                </select>
                <button id="add-topic-btn" class="btn btn-secondary w-full" disabled>Add Today's Topic</button>
            </div>
            
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📝 Assign Homework</h3>
                <p class="text-sm text-gray-600 mb-4">Assign homework to your students</p>
                <select id="select-student-hw" class="form-input mb-3">
                    <option value="">Select a student...</option>
                </select>
                <button id="assign-hw-btn" class="btn btn-warning w-full" disabled>Assign Homework</button>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="font-bold text-lg">🔍 Search & Filter</h3>
            </div>
            <div class="card-body">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="form-label">Search by Parent Name</label>
                        <input type="text" id="searchName" class="form-input" placeholder="Enter parent name...">
                    </div>
                    <div>
                        <label class="form-label">Filter by Status</label>
                        <select id="filterStatus" class="form-input">
                            <option value="">All Submissions</option>
                            <option value="pending">Pending Review</option>
                            <option value="graded">Graded</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button id="searchBtn" class="btn btn-primary w-full">
                            🔍 Search
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">📋 Pending Submissions</h3>
                <span class="badge badge-warning" id="pending-count">Loading...</span>
            </div>
            <div id="pendingReportsContainer" class="space-y-4">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="spinner mx-auto mb-2"></div>
                        <p class="text-gray-500">Loading pending submissions...</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-8">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">✅ Graded Submissions</h3>
                <button id="toggle-graded-btn" class="btn btn-secondary btn-sm">
                    👁️ Show/Hide
                </button>
            </div>
            <div id="gradedReportsContainer" class="space-y-4 hidden">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="spinner mx-auto mb-2"></div>
                        <p class="text-gray-500">Loading graded submissions...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load student dropdowns
    loadStudentDropdowns(tutor.email);

    // Add event listeners for new buttons
    const viewCalendarBtn = document.getElementById('view-full-calendar-btn');
    if (viewCalendarBtn) {
        viewCalendarBtn.addEventListener('click', showScheduleCalendarModal);
    }
    
    const setupSchedulesBtn = document.getElementById('setup-all-schedules-btn');
    if (setupSchedulesBtn) {
        setupSchedulesBtn.addEventListener('click', () => {
            checkAndShowSchedulePopup(tutor);
        });
    }
    
    const addTopicBtn = document.getElementById('add-topic-btn');
    if (addTopicBtn) {
        addTopicBtn.addEventListener('click', () => {
            const studentId = document.getElementById('select-student-topic').value;
            const student = getStudentFromCache(studentId);
            if (student) {
                showDailyTopicModal(student);
            }
        });
    }
    
    const assignHwBtn = document.getElementById('assign-hw-btn');
    if (assignHwBtn) {
        assignHwBtn.addEventListener('click', () => {
            const studentId = document.getElementById('select-student-hw').value;
            const student = getStudentFromCache(studentId);
            if (student) {
                showHomeworkModal(student);
            }
        });
    }
    
    // Enable buttons when students are selected
    const topicSelect = document.getElementById('select-student-topic');
    if (topicSelect) {
        topicSelect.addEventListener('change', (e) => {
            const addTopicBtn = document.getElementById('add-topic-btn');
            if (addTopicBtn) {
                addTopicBtn.disabled = !e.target.value;
            }
        });
    }
    
    const hwSelect = document.getElementById('select-student-hw');
    if (hwSelect) {
        hwSelect.addEventListener('change', (e) => {
            const assignHwBtn = document.getElementById('assign-hw-btn');
            if (assignHwBtn) {
                assignHwBtn.disabled = !e.target.value;
            }
        });
    }

    const toggleGradedBtn = document.getElementById('toggle-graded-btn');
    if (toggleGradedBtn) {
        toggleGradedBtn.addEventListener('click', () => {
            const gradedContainer = document.getElementById('gradedReportsContainer');
            const toggleBtn = document.getElementById('toggle-graded-btn');
            
            if (gradedContainer.classList.contains('hidden')) {
                gradedContainer.classList.remove('hidden');
                toggleBtn.innerHTML = '👁️ Hide';
            } else {
                gradedContainer.classList.add('hidden');
                toggleBtn.innerHTML = '👁️ Show';
            }
        });
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const name = document.getElementById('searchName').value.trim();
            const status = document.getElementById('filterStatus').value;
            await loadTutorReports(tutor.email, name || null, status || null);
        });
    }

    loadTutorReports(tutor.email);
}

async function loadStudentDropdowns(tutorEmail) {
    try {
        const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        studentCache = [];
        const students = [];
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            // Filter out archived students
            if (!['archived', 'graduated', 'transferred'].includes(student.status)) {
                students.push(student);
                studentCache.push(student);
            }
        });
        
        const topicSelect = document.getElementById('select-student-topic');
        const hwSelect = document.getElementById('select-student-hw');
        
        if (topicSelect && hwSelect) {
            while (topicSelect.options.length > 1) topicSelect.remove(1);
            while (hwSelect.options.length > 1) hwSelect.remove(1);
            
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.studentName} (${student.grade})`;
                
                const option2 = option.cloneNode(true);
                topicSelect.appendChild(option);
                hwSelect.appendChild(option2);
            });
        }
    } catch (error) {
        console.error("Error loading student dropdowns:", error);
    }
}

function getStudentFromCache(studentId) {
    return studentCache.find(s => s.id === studentId);
}

async function loadTutorReports(tutorEmail, parentName = null, statusFilter = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');
    
    if (!pendingReportsContainer) return;
    
    pendingReportsContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <div class="spinner mx-auto mb-2"></div>
                <p class="text-gray-500">Loading submissions...</p>
            </div>
        </div>
    `;
    
    if (gradedReportsContainer) {
        gradedReportsContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <div class="spinner mx-auto mb-2"></div>
                    <p class="text-gray-500">Loading graded submissions...</p>
                </div>
            </div>
        `;
    }

    try {
        let assessmentsQuery = query(
            collection(db, "student_results"), 
            where("tutorEmail", "==", tutorEmail)
        );

        if (parentName) {
            assessmentsQuery = query(assessmentsQuery, where("parentName", "==", parentName));
        }

        let creativeWritingQuery = query(
            collection(db, "tutor_submissions"),
            where("tutorEmail", "==", tutorEmail),
            where("type", "==", "creative_writing")
        );

        if (parentName) {
            creativeWritingQuery = query(creativeWritingQuery, where("parentName", "==", parentName));
        }

        const [assessmentsSnapshot, creativeWritingSnapshot] = await Promise.all([
            getDocs(assessmentsQuery),
            getDocs(creativeWritingQuery)
        ]);

        let pendingHTML = '';
        let gradedHTML = '';
        let pendingCount = 0;
        let gradedCount = 0;

        assessmentsSnapshot.forEach(doc => {
            const data = doc.data();
            const needsFeedback = data.answers && data.answers.some(answer => 
                answer.type === 'creative-writing' && 
                (!answer.tutorReport || answer.tutorReport.trim() === '')
            );

            const reportCard = `
                <div class="card">
                    <div class="card-body">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h4 class="font-bold text-lg">${data.studentName}</h4>
                                <p class="text-gray-600">${data.parentName || 'N/A'} • ${data.grade}</p>
                            </div>
                            <span class="badge ${needsFeedback ? 'badge-warning' : 'badge-success'}">
                                ${needsFeedback ? 'Pending Review' : 'Graded'}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div class="bg-gray-50 p-3 rounded">
                                <span class="text-sm text-gray-500">Type:</span>
                                <p class="font-medium">Multiple-Choice Test</p>
                            </div>
                            <div class="bg-gray-50 p-3 rounded">
                                <span class="text-sm text-gray-500">Submitted:</span>
                                <p class="font-medium">${new Date(data.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                            </div>
                            <div class="bg-gray-50 p-3 rounded">
                                <span class="text-sm text-gray-500">Status:</span>
                                <p class="font-medium">${needsFeedback ? 'Needs Feedback' : 'Completed'}</p>
                            </div>
                        </div>

                        <div class="border-t pt-4">
                            <h5 class="font-semibold mb-2">Assessment Details:</h5>
                            ${data.answers ? data.answers.map((answer, index) => {
                                if (answer.type === 'creative-writing') {
                                    return `
                                        <div class="mb-4 p-4 bg-blue-50 rounded-lg">
                                            <div class="flex justify-between items-start mb-2">
                                                <h6 class="font-semibold">Creative Writing</h6>
                                                <span class="badge ${answer.tutorReport ? 'badge-success' : 'badge-warning'}">
                                                    ${answer.tutorReport ? 'Graded' : 'Pending'}
                                                </span>
                                            </div>
                                            <p class="italic text-gray-700 mb-3">${answer.textAnswer || "No response"}</p>
                                            ${answer.fileUrl ? `
                                                <a href="${answer.fileUrl}" target="_blank" class="btn btn-secondary btn-sm">
                                                    📎 Download File
                                                </a>
                                            ` : ''}
                                            
                                            ${!answer.tutorReport ? `
                                                <div class="mt-3">
                                                    <label class="form-label">Your Feedback</label>
                                                    <textarea class="form-input form-textarea tutor-report" rows="3" placeholder="Write your feedback here..."></textarea>
                                                    <button class="btn btn-primary mt-2 submit-report-btn" 
                                                            data-doc-id="${doc.id}" 
                                                            data-collection="student_results" 
                                                            data-answer-index="${index}">
                                                        Submit Feedback
                                                    </button>
                                                </div>
                                            ` : `
                                                <div class="mt-3 bg-white p-3 rounded border">
                                                    <label class="form-label">Your Feedback:</label>
                                                    <p class="text-gray-700">${answer.tutorReport || 'N/A'}</p>
                                                </div>
                                            `}
                                        </div>
                                    `;
                                }
                                return '';
                            }).join('') : '<p class="text-gray-500">No assessment data available.</p>'}
                        </div>
                    </div>
                </div>
            `;

            if (needsFeedback) {
                if (!statusFilter || statusFilter === 'pending') {
                    pendingHTML += reportCard;
                    pendingCount++;
                }
            } else {
                if (!statusFilter || statusFilter === 'graded') {
                    gradedHTML += reportCard;
                    gradedCount++;
                }
            }
        });

        creativeWritingSnapshot.forEach(doc => {
            const data = doc.data();
            const needsFeedback = !data.tutorReport || data.tutorReport.trim() === '';

            const creativeWritingCard = `
                <div class="card border-l-4 border-blue-500">
                    <div class="card-body">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h4 class="font-bold text-lg">${data.studentName}</h4>
                                <p class="text-gray-600">${data.parentName || 'N/A'} • ${data.grade}</p>
                            </div>
                            <span class="badge ${needsFeedback ? 'badge-warning' : 'badge-success'}">
                                ${needsFeedback ? 'Pending Review' : 'Graded'}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div class="bg-blue-50 p-3 rounded">
                                <span class="text-sm text-blue-500">Type:</span>
                                <p class="font-medium">Creative Writing</p>
                            </div>
                            <div class="bg-blue-50 p-3 rounded">
                                <span class="text-sm text-blue-500">Submitted:</span>
                                <p class="font-medium">${new Date(data.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                            </div>
                            <div class="bg-blue-50 p-3 rounded">
                                <span class="text-sm text-blue-500">Status:</span>
                                <p class="font-medium">${needsFeedback ? 'Needs Review' : 'Completed'}</p>
                            </div>
                        </div>

                        <div class="border-t pt-4">
                            <h5 class="font-semibold mb-2">Writing Assignment:</h5>
                            <div class="mb-4 p-4 bg-blue-50 rounded-lg">
                                <p class="font-medium mb-2">${data.questionText || 'Creative Writing Assignment'}</p>
                                <p class="italic text-gray-700 bg-white p-3 rounded border">${data.textAnswer || "No response"}</p>
                                ${data.fileUrl ? `
                                    <a href="${data.fileUrl}" target="_blank" class="btn btn-secondary btn-sm mt-3">
                                        📎 Download Attachment
                                    </a>
                                ` : ''}
                            </div>
                            
                            ${!data.tutorReport ? `
                                <div class="mt-4">
                                    <label class="form-label">Your Feedback</label>
                                    <textarea class="form-input form-textarea tutor-report" rows="4" placeholder="Provide constructive feedback on the student's writing..."></textarea>
                                    <button class="btn btn-primary mt-3 submit-report-btn" 
                                            data-doc-id="${doc.id}" 
                                            data-collection="tutor_submissions">
                                        Submit Feedback
                                    </button>
                                </div>
                            ` : `
                                <div class="mt-4 bg-white p-4 rounded border">
                                    <label class="form-label">Your Feedback:</label>
                                    <p class="text-gray-700">${data.tutorReport || 'N/A'}</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;

            if (needsFeedback) {
                if (!statusFilter || statusFilter === 'pending') {
                    pendingHTML += creativeWritingCard;
                    pendingCount++;
                }
            } else {
                if (!statusFilter || statusFilter === 'graded') {
                    gradedHTML += creativeWritingCard;
                    gradedCount++;
                }
            }
        });

        const pendingCountElement = document.getElementById('pending-count');
        if (pendingCountElement) {
            pendingCountElement.textContent = `${pendingCount} Pending`;
        }
        
        pendingReportsContainer.innerHTML = pendingHTML || `
            <div class="card">
                <div class="card-body text-center">
                    <div class="text-gray-400 text-4xl mb-3">📭</div>
                    <h4 class="font-bold text-gray-600 mb-2">No Pending Submissions</h4>
                    <p class="text-gray-500">All caught up! No submissions need your review.</p>
                </div>
            </div>
        `;
        
        if (gradedReportsContainer) {
            gradedReportsContainer.innerHTML = gradedHTML || `
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-gray-400 text-4xl mb-3">✅</div>
                        <h4 class="font-bold text-gray-600 mb-2">No Graded Submissions</h4>
                        <p class="text-gray-500">No submissions have been graded yet.</p>
                    </div>
                </div>
            `;
        }

        document.querySelectorAll('.submit-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-doc-id');
                const collectionName = e.target.getAttribute('data-collection');
                const answerIndex = e.target.getAttribute('data-answer-index');
                const reportTextarea = e.target.closest('.mb-4, .mt-4').querySelector('.tutor-report');
                const tutorReport = reportTextarea.value.trim();
                
                if (tutorReport) {
                    try {
                        const docRef = doc(db, collectionName, docId);
                        
                        if (collectionName === "student_results" && answerIndex !== null) {
                            const docSnap = await getDoc(docRef);
                            const currentData = docSnap.data();
                            
                            const updatedAnswers = [...currentData.answers];
                            updatedAnswers[parseInt(answerIndex)] = {
                                ...updatedAnswers[parseInt(answerIndex)],
                                tutorReport: tutorReport,
                                gradedAt: new Date()
                            };
                            
                            await updateDoc(docRef, { 
                                answers: updatedAnswers,
                                hasTutorFeedback: true
                            });
                        } else {
                            await updateDoc(docRef, { 
                                tutorReport: tutorReport,
                                gradedAt: new Date(),
                                status: "graded"
                            });
                        }
                        
                        showCustomAlert('✅ Feedback submitted successfully!');
                        loadTutorReports(tutorEmail, parentName, statusFilter);
                    } catch (error) {
                        console.error("Error submitting feedback:", error);
                        showCustomAlert('❌ Failed to submit feedback. Please try again.');
                    }
                } else {
                    showCustomAlert('Please write some feedback before submitting.');
                }
            });
        });
    } catch (error) {
        console.error("Error loading tutor reports:", error);
        pendingReportsContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <div class="text-red-400 text-4xl mb-3">⚠️</div>
                    <h4 class="font-bold text-red-600 mb-2">Failed to Load Reports</h4>
                    <p class="text-gray-500">Please check your connection and try again.</p>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">Retry</button>
                </div>
            </div>
        `;
    }
}

/*******************************************************************************
 * SECTION 12: STUDENT DATABASE MANAGEMENT (UPDATED WITH PROPER MODAL STYLING)
 ******************************************************************************/

// Enhanced Student Database
function getNewStudentFormFields() {
    const gradeOptions = `
        <option value="">Select Grade</option>
        <option value="Preschool">Preschool</option>
        <option value="Kindergarten">Kindergarten</option>
        ${Array.from({ length: 12 }, (_, i) => `<option value="Grade ${i + 1}">Grade ${i + 1}</option>`).join('')}
        <option value="Pre-College">Pre-College</option>
        <option value="College">College</option>
        <option value="Adults">Adults</option>
    `;

    let feeOptions = '<option value="">Select Fee (₦)</option>';
    for (let fee = 10000; fee <= 400000; fee += 5000) {
        feeOptions += `<option value="${fee}">₦${fee.toLocaleString()}</option>`;
    }
    
    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry", "Microbiology"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa", "Arabic"],
        "Tech Courses": ["Coding","ICT", "Stop motion animation", "Computer Appreciation", "Digital Entrepeneurship", "Animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Counseling Programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills", "English Proficiency"]
    };

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="new-student-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${category}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => `<div><label class="text-sm font-normal"><input type="checkbox" name="subjects" value="${subject}"> ${subject}</label></div>`).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `
        <div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="subjects" value="Music"> Music</label></div>
    </div>`;

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-group">
                <label class="form-label">Parent Name *</label>
                <input type="text" id="new-parent-name" class="form-input" placeholder="Parent Name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Parent Phone *</label>
                <input type="tel" id="new-parent-phone" class="form-input" placeholder="Parent Phone Number" required>
            </div>
            <div class="form-group">
                <label class="form-label">Student Name *</label>
                <input type="text" id="new-student-name" class="form-input" placeholder="Student Name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Grade *</label>
                <select id="new-student-grade" class="form-input" required>${gradeOptions}</select>
            </div>
        </div>
        
        ${subjectsHTML}
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div class="form-group">
                <label class="form-label">Days per Week *</label>
                <select id="new-student-days" class="form-input" required>
                    <option value="">Select Days per Week</option>
                    ${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Fee (₦) *</label>
                <select id="new-student-fee" class="form-input" required>${feeOptions}</select>
            </div>
        </div>
        
        <div id="group-class-container" class="hidden mt-4">
            <label class="flex items-center space-x-2">
                <input type="checkbox" id="new-student-group-class" class="rounded">
                <span class="text-sm font-semibold">Group Class</span>
            </label>
        </div>
    `;
}

function showEditStudentModal(student) {
    let gradeOptions = `
        <option value="">Select Grade</option>
        <option value="Preschool" ${student.grade === 'Preschool' ? 'selected' : ''}>Preschool</option>
        <option value="Kindergarten" ${student.grade === 'Kindergarten' ? 'selected' : ''}>Kindergarten</option>
    `;
    for (let i = 1; i <= 12; i++) {
        const gradeValue = `Grade ${i}`;
        gradeOptions += `<option value="${gradeValue}" ${student.grade === gradeValue ? 'selected' : ''}>${gradeValue}</option>`;
    }
    gradeOptions += `
        <option value="Pre-College" ${student.grade === 'Pre-College' ? 'selected' : ''}>Pre-College</option>
        <option value="College" ${student.grade === 'College' ? 'selected' : ''}>College</option>
        <option value="Adults" ${student.grade === 'Adults' ? 'selected' : ''}>Adults</option>
    `;
    
    let daysOptions = '<option value="">Select Days per Week</option>';
    for (let i = 1; i <= 7; i++) {
        daysOptions += `<option value="${i}" ${student.days == i ? 'selected' : ''}>${i}</option>`;
    }

    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry", "Microbiology"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa", "Arabic"],
        "Tech Courses": ["Coding","ICT", "Stop motion animation", "Computer Appreciation", "Digital Entrepeneurship", "Animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Counseling Programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills", "English Proficiency"]
    };

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="edit-student-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${category}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => {
                        const isChecked = student.subjects && student.subjects.includes(subject);
                        return `<div><label class="text-sm font-normal"><input type="checkbox" name="edit-subjects" value="${subject}" ${isChecked ? 'checked' : ''}> ${subject}</label></div>`;
                    }).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `
        <div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="edit-subjects" value="Music" ${student.subjects && student.subjects.includes('Music') ? 'checked' : ''}> Music</label></div>
    </div>`;

    const editFormHTML = `
        <h3 class="text-xl font-bold mb-4">Edit Student: ${student.studentName}</h3>
        <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Parent Name</label>
                    <input type="text" id="edit-parent-name" class="form-input" value="${student.parentName || ''}" placeholder="Parent Name">
                </div>
                <div>
                    <label class="form-label">Parent Phone Number</label>
                    <input type="tel" id="edit-parent-phone" class="form-input" value="${student.parentPhone || ''}" placeholder="Parent Phone Number">
                </div>
                <div>
                    <label class="form-label">Student Name</label>
                    <input type="text" id="edit-student-name" class="form-input" value="${student.studentName || ''}" placeholder="Student Name">
                </div>
                <div>
                    <label class="form-label">Grade</label>
                    <select id="edit-student-grade" class="form-input">${gradeOptions}</select>
                </div>
            </div>
            
            ${subjectsHTML}
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Days per Week</label>
                    <select id="edit-student-days" class="form-input">${daysOptions}</select>
                </div>
                <div>
                    <label class="form-label">Fee (₦)</label>
                    <input type="text" id="edit-student-fee" class="form-input" 
                           value="${(student.studentFee || 0).toLocaleString()}" 
                           placeholder="Enter fee (e.g., 50,000)">
                </div>
            </div>
            
            <div id="edit-group-class-container" class="${findSpecializedSubject(student.subjects || []) ? '' : 'hidden'}">
                <label class="flex items-center space-x-2">
                    <input type="checkbox" id="edit-student-group-class" class="rounded" ${student.groupClass ? 'checked' : ''}>
                    <span class="text-sm font-semibold">Group Class</span>
                </label>
            </div>
            
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-edit-btn" class="btn btn-secondary">Cancel</button>
                <button id="save-edit-btn" class="btn btn-primary" data-student-id="${student.id}" data-collection="${student.collection}">Save Changes</button>
            </div>
        </div>`;

    const editModal = document.createElement('div');
    editModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
    editModal.innerHTML = `<div class="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">${editFormHTML}</div>`;
    document.body.appendChild(editModal);

    document.getElementById('cancel-edit-btn').addEventListener('click', () => editModal.remove());
    document.getElementById('save-edit-btn').addEventListener('click', async (e) => {
        const studentId = e.target.getAttribute('data-student-id');
        const collectionName = e.target.getAttribute('data-collection');
        
        const parentName = document.getElementById('edit-parent-name').value.trim();
        const parentPhone = document.getElementById('edit-parent-phone').value.trim();
        const studentName = document.getElementById('edit-student-name').value.trim();
        const studentGrade = document.getElementById('edit-student-grade').value.trim();
        
        const selectedSubjects = [];
        document.querySelectorAll('input[name="edit-subjects"]:checked').forEach(checkbox => {
            selectedSubjects.push(checkbox.value);
        });

        const studentDays = document.getElementById('edit-student-days').value.trim();
        const groupClass = document.getElementById('edit-student-group-class') ? document.getElementById('edit-student-group-class').checked : false;
        
        const feeValue = document.getElementById('edit-student-fee').value.trim();
        const studentFee = parseFloat(feeValue.replace(/,/g, ''));

        if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
            showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.');
            return;
        }

        if (isNaN(studentFee) || studentFee < 0) {
            showCustomAlert('Please enter a valid fee amount.');
            return;
        }

        try {
            const studentData = {
                parentName: parentName,
                parentPhone: parentPhone,
                studentName: studentName,
                grade: studentGrade,
                subjects: selectedSubjects,
                days: studentDays,
                studentFee: studentFee
            };

            if (document.getElementById('edit-student-group-class')) {
                studentData.groupClass = groupClass;
            }

            const studentRef = doc(db, collectionName, studentId);
            await updateDoc(studentRef, studentData);
            
            editModal.remove();
            showCustomAlert('✅ Student details updated successfully!');
            
            const mainContent = document.getElementById('mainContent');
            if (mainContent && window.tutorData) {
                renderStudentDatabase(mainContent, window.tutorData);
            }
        } catch (error) {
            console.error("Error updating student:", error);
            showCustomAlert(`❌ An error occurred: ${error.message}`);
        }
    });
}

// ==========================================
// REPORT MODAL AND FEE CONFIRMATION MODAL
// ==========================================

function showReportModal(student) {
    const existingReport = savedReports[student.id] || {};
    const isSingleApprovedStudent = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length === 1;
    const currentMonthYear = getCurrentMonthYear();
    
    const reportFormHTML = `
        <h3 class="text-xl font-bold mb-4">📝 Monthly Report for ${student.studentName}</h3>
        <div class="bg-blue-50 p-4 rounded-lg mb-4">
            <p class="font-semibold text-blue-800">Month: ${currentMonthYear}</p>
        </div>
        <div class="space-y-4">
            <div class="form-group">
                <label class="form-label">Introduction</label>
                <textarea id="report-intro" class="form-input form-textarea report-textarea" rows="3">${existingReport.introduction || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Topics & Remarks</label>
                <textarea id="report-topics" class="form-input form-textarea report-textarea" rows="4">${existingReport.topics || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Progress & Achievements</label>
                <textarea id="report-progress" class="form-input form-textarea report-textarea" rows="3">${existingReport.progress || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Strengths & Weaknesses</label>
                <textarea id="report-sw" class="form-input form-textarea report-textarea" rows="3">${existingReport.strengthsWeaknesses || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Recommendations</label>
                <textarea id="report-recs" class="form-input form-textarea report-textarea" rows="3">${existingReport.recommendations || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">General Comments</label>
                <textarea id="report-general" class="form-input form-textarea report-textarea" rows="3">${existingReport.generalComments || ''}</textarea>
            </div>
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-report-btn" class="btn btn-secondary">Cancel</button>
                <button id="modal-action-btn" class="btn btn-primary">${isSingleApprovedStudent ? 'Proceed to Submit' : 'Save Report'}</button>
            </div>
        </div>`;
    
    const reportModal = document.createElement('div');
    reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
    reportModal.innerHTML = `<div class="relative mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-lg bg-white">${reportFormHTML}</div>`;
    document.body.appendChild(reportModal);

    document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());
    document.getElementById('modal-action-btn').addEventListener('click', async () => {
        const reportData = {
            studentId: student.id, 
            studentName: student.studentName, 
            grade: student.grade,
            parentName: student.parentName, 
            parentPhone: student.parentPhone,
            normalizedParentPhone: normalizePhoneNumber(student.parentPhone),
            reportMonth: currentMonthYear,
            introduction: document.getElementById('report-intro').value,
            topics: document.getElementById('report-topics').value,
            progress: document.getElementById('report-progress').value,
            strengthsWeaknesses: document.getElementById('report-sw').value,
            recommendations: document.getElementById('report-recs').value,
            generalComments: document.getElementById('report-general').value
        };

        reportModal.remove();
        showFeeConfirmationModal(student, reportData);
    });
}

function showFeeConfirmationModal(student, reportData) {
    const feeConfirmationHTML = `
        <h3 class="text-xl font-bold mb-4">💰 Confirm Fee for ${student.studentName}</h3>
        <p class="text-sm text-gray-600 mb-4">Please verify the monthly fee for this student before saving the report.</p>
        <div class="space-y-4">
            <div class="form-group">
                <label class="form-label">Current Fee (₦)</label>
                <input type="number" id="confirm-student-fee" class="form-input" 
                       value="${student.studentFee || 0}" 
                       placeholder="Enter fee amount">
            </div>
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-fee-confirm-btn" class="btn btn-secondary">Cancel</button>
                <button id="confirm-fee-btn" class="btn btn-primary">Confirm Fee & Save</button>
            </div>
        </div>`;

    const feeModal = document.createElement('div');
    feeModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
    feeModal.innerHTML = `<div class="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-lg bg-white">${feeConfirmationHTML}</div>`;
    document.body.appendChild(feeModal);

    const isSingleApprovedStudent = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length === 1;

    document.getElementById('cancel-fee-confirm-btn').addEventListener('click', () => feeModal.remove());
    document.getElementById('confirm-fee-btn').addEventListener('click', async () => {
        const newFeeValue = document.getElementById('confirm-student-fee').value;
        const newFee = parseFloat(newFeeValue);

        if (isNaN(newFee) || newFee < 0) {
            showCustomAlert('Please enter a valid, non-negative fee amount.');
            return;
        }

        if (newFee !== student.studentFee) {
            try {
                const studentRef = doc(db, student.collection, student.id);
                await updateDoc(studentRef, { studentFee: newFee });
                student.studentFee = newFee; 
                showCustomAlert('✅ Student fee has been updated successfully!');
            } catch (error) {
                console.error("Error updating student fee:", error);
                showCustomAlert(`❌ Failed to update fee: ${error.message}`);
            }
        }

        feeModal.remove();

        if (isSingleApprovedStudent) {
            showAccountDetailsModal([reportData]);
        } else {
            savedReports[student.id] = reportData;
            await saveReportsToFirestore(tutor.email, savedReports);
            showCustomAlert(`✅ ${student.studentName}'s report has been saved.`);
            renderUI(); 
        }
    });
}

function showAccountDetailsModal(reportsArray) {
    const accountFormHTML = `
        <h3 class="text-xl font-bold mb-4">🏦 Enter Your Payment Details</h3>
        <p class="text-sm text-gray-600 mb-4">Please provide your bank details for payment processing.</p>
        <div class="space-y-4">
            <div class="form-group">
                <label class="form-label">Beneficiary Bank Name *</label>
                <input type="text" id="beneficiary-bank" class="form-input" placeholder="e.g., Zenith Bank" required>
            </div>
            <div class="form-group">
                <label class="form-label">Beneficiary Account Number *</label>
                <input type="text" id="beneficiary-account" class="form-input" placeholder="Your 10-digit account number" required>
            </div>
            <div class="form-group">
                <label class="form-label">Beneficiary Name *</label>
                <input type="text" id="beneficiary-name" class="form-input" placeholder="Your full name as on the account" required>
            </div>
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-account-btn" class="btn btn-secondary">Cancel</button>
                <button id="confirm-submit-btn" class="btn btn-primary">Confirm & Submit Report(s)</button>
            </div>
        </div>`;
    const accountModal = document.createElement('div');
    accountModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
    accountModal.innerHTML = `<div class="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-lg bg-white">${accountFormHTML}</div>`;
    document.body.appendChild(accountModal);

    document.getElementById('cancel-account-btn').addEventListener('click', () => accountModal.remove());
    document.getElementById('confirm-submit-btn').addEventListener('click', async () => {
        const accountDetails = {
            beneficiaryBank: document.getElementById('beneficiary-bank').value.trim(),
            beneficiaryAccount: document.getElementById('beneficiary-account').value.trim(),
            beneficiaryName: document.getElementById('beneficiary-name').value.trim(),
        };

        if (!accountDetails.beneficiaryBank || !accountDetails.beneficiaryAccount || !accountDetails.beneficiaryName) {
            showCustomAlert("❌ Please fill in all bank account details before submitting.");
            return;
        }

        accountModal.remove();
        await submitAllReports(reportsArray, accountDetails);
    });
}

async function renderStudentDatabase(container, tutor) {
    // Update active tab
    updateActiveTab('navStudentDatabase');
    
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    let savedReports = await loadReportsFromFirestore(tutor.email);

    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const pendingStudentQuery = query(collection(db, "pending_students"), where("tutorEmail", "==", tutor.email));
    const allSubmissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutor.email));

    const [studentsSnapshot, pendingStudentsSnapshot, allSubmissionsSnapshot] = await Promise.all([
        getDocs(studentQuery),
        getDocs(pendingStudentQuery),
        getDocs(allSubmissionsQuery)
    ]);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const submittedStudentIds = new Set();

    allSubmissionsSnapshot.forEach(doc => {
        const submissionData = doc.data();
        const submissionDate = submissionData.submittedAt.toDate();
        if (submissionDate.getMonth() === currentMonth && submissionDate.getFullYear() === currentYear) {
            submittedStudentIds.add(submissionData.studentId);
        }
    });

    const approvedStudents = studentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), isPending: false, collection: "students" }))
        .filter(student => !['archived', 'graduated', 'transferred'].includes(student.status));

    const pendingStudents = pendingStudentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), isPending: true, collection: "pending_students" }))
        .filter(student => !['archived', 'graduated', 'transferred'].includes(student.status));

    let students = [...approvedStudents, ...pendingStudents];

    const seenStudents = new Set();
    const duplicatesToDelete = [];
    students = students.filter(student => {
        const studentIdentifier = `${student.studentName}-${student.tutorEmail}`;
        if (seenStudents.has(studentIdentifier)) {
            duplicatesToDelete.push({ id: student.id, collection: student.collection });
            return false;
        }
        seenStudents.add(studentIdentifier);
        return true;
    });
    if (duplicatesToDelete.length > 0) {
        const batch = writeBatch(db);
        duplicatesToDelete.forEach(dup => {
            batch.delete(doc(db, dup.collection, dup.id));
        });
        await batch.commit();
        console.log(`Cleaned up ${duplicatesToDelete.length} duplicate student entries.`);
    }

    const studentsCount = students.length;

    function renderUI() {
        let studentsHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">📚 My Students (${studentsCount})</h2>
            </div>
        `;
        
        studentsHTML += `
            <div class="card mb-6">
                <div class="card-header">
                    <h3 class="font-bold text-lg">➕ Add a New Student</h3>
                </div>
                <div class="card-body">
                    <div class="space-y-4">
                        ${getNewStudentFormFields()}
                    </div>
                    <div class="action-buttons mt-4">`;
        
        if (isTutorAddEnabled) {
            studentsHTML += `<button id="add-student-btn" class="btn btn-primary">➕ Add Student</button>`;
        }
        
        studentsHTML += `<button id="add-transitioning-btn" class="btn btn-warning">🔄 Add Transitioning</button>`;
        
        studentsHTML += `</div></div></div>`;
        
        studentsHTML += `
            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-medium">Report Submission Status:</span>
                        <span class="${isSubmissionEnabled ? 'text-green-600 font-bold ml-2' : 'text-red-600 font-bold ml-2'}">
                            ${isSubmissionEnabled ? '✅ Enabled' : '❌ Disabled'}
                        </span>
                    </div>
                    <span class="text-sm text-gray-500">Set by admin</span>
                </div>
            </div>
        `;

        if (studentsCount === 0) {
            studentsHTML += `
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-gray-400 text-4xl mb-3">👤</div>
                        <h4 class="font-bold text-gray-600 mb-2">No Students Assigned</h4>
                        <p class="text-gray-500">You are not assigned to any students yet.</p>
                    </div>
                </div>
            `;
        } else {
            studentsHTML += `
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Student Name</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            students.forEach(student => {
                const hasSubmittedThisMonth = submittedStudentIds.has(student.id);
                const isStudentOnBreak = student.summerBreak;
                const isReportSaved = savedReports[student.id];
                const isTransitioning = student.isTransitioning;

                const feeDisplay = showStudentFees ? `<div class="text-xs text-gray-500 mt-1">Fee: ₦${(student.studentFee || 0).toLocaleString()}</div>` : '';
                
                const subjects = student.subjects ? student.subjects.join(', ') : 'N/A';
                const days = student.days ? `${student.days} days/week` : 'N/A';

                let statusHTML = '';
                let actionsHTML = '';

                if (student.isPending) {
                    statusHTML = `<span class="badge badge-warning">⏳ Awaiting Approval</span>`;
                    actionsHTML = `<span class="text-gray-400">No actions available</span>`;
                } else if (hasSubmittedThisMonth) {
                    statusHTML = `<span class="badge badge-info">📤 Report Sent</span>`;
                    actionsHTML = `<span class="text-gray-400">Submitted this month</span>`;
                } else {
                    const transitioningIndicator = isTransitioning ? `<span class="badge badge-warning ml-2">🔄 Transitioning</span>` : '';
                    
                    statusHTML = `<span class="${isReportSaved ? 'badge badge-success' : 'badge badge-secondary'}">${isReportSaved ? '💾 Report Saved' : '📝 Pending Report'}</span>${transitioningIndicator}`;

                    actionsHTML = `<div class="action-buttons">`;

                    if (isSummerBreakEnabled && !isStudentOnBreak) {
                        actionsHTML += `<button class="btn btn-warning btn-sm summer-break-btn" data-student-id="${student.id}">⏸️ Break</button>`;
                    } else if (isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">On Break</span>`;
                    }

                    if (isSubmissionEnabled && !isStudentOnBreak) {
                        if (approvedStudents.length === 1) {
                            actionsHTML += `<button class="btn btn-primary btn-sm submit-single-report-btn" data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">📝 Submit Report</button>`;
                        } else {
                            actionsHTML += `<button class="btn btn-primary btn-sm enter-report-btn" data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">${isReportSaved ? '✏️ Edit Report' : '📝 Enter Report'}</button>`;
                        }
                    } else if (!isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                    }
                    
                    if (showEditDeleteButtons && !isStudentOnBreak) {
                        actionsHTML += `
                            <button class="btn btn-info btn-sm edit-student-btn-tutor" data-student-id="${student.id}" data-collection="${student.collection}">✏️ Edit</button>
                            <button class="btn btn-danger btn-sm delete-student-btn-tutor" data-student-id="${student.id}" data-collection="${student.collection}">🗑️ Delete</button>
                        `;
                    }
                    
                    actionsHTML += `</div>`;
                }
                
                studentsHTML += `
                    <tr>
                        <td>
                            <div class="font-medium">${student.studentName}</div>
                            <div class="text-sm text-gray-500">${cleanGradeString(student.grade)}</div>
                            <div class="text-xs text-gray-400">Subjects: ${subjects}</div>
                            <div class="text-xs text-gray-400">Days: ${days}</div>
                            ${feeDisplay}
                        </td>
                        <td>${statusHTML}</td>
                        <td>${actionsHTML}</td>
                    </tr>`;
            });

            studentsHTML += `</tbody></table></div>`;
            
            if (tutor.isManagementStaff) {
                studentsHTML += `
                    <div class="card mt-6">
                        <div class="card-header">
                            <h3 class="font-bold text-lg">💼 Management Fee</h3>
                        </div>
                        <div class="card-body">
                            <p class="text-sm text-gray-600 mb-4">As you are part of the management staff, please set your monthly management fee before final submission.</p>
                            <div class="flex items-center space-x-4">
                                <div class="flex-1">
                                    <label class="form-label">Monthly Management Fee (₦)</label>
                                    <input type="number" id="management-fee-input" class="form-input" value="${tutor.managementFee || 0}">
                                </div>
                                <button id="save-management-fee-btn" class="btn btn-primary mt-6">Save Fee</button>
                            </div>
                        </div>
                    </div>`;
            }
            
            if (approvedStudents.length > 1 && isSubmissionEnabled) {
                const submittableStudents = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length;
                const allReportsSaved = Object.keys(savedReports).length === submittableStudents && submittableStudents > 0;
                
                if (submittableStudents > 0) {
                    studentsHTML += `
                        <div class="mt-6 text-right">
                            <button id="submit-all-reports-btn" class="btn btn-primary ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : ''}" ${!allReportsSaved ? 'disabled' : ''}>
                                📤 Submit All Reports (${submittableStudents})
                            </button>
                        </div>`;
                }
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg">${studentsHTML}</div>`;
        attachEventListeners();
    }

    function showTransitioningConfirmation() {
        const confirmationHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div class="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white">
                    <div class="modal-header">
                        <h3 class="text-xl font-bold text-orange-600">🔄 Add Transitioning Student</h3>
                    </div>
                    <div class="modal-body">
                        <p class="text-sm text-gray-600 mb-4">
                            <strong>Please confirm:</strong> Transitioning students skip monthly report writing and go directly to fee confirmation. 
                            They will be marked with orange indicators and their fees will be included in pay advice.
                        </p>
                        <p class="text-sm text-orange-600 font-semibold mb-4">
                            Are you sure you want to add a transitioning student?
                        </p>
                        <div class="flex justify-end space-x-2 mt-6">
                            <button id="cancel-transitioning-btn" class="btn btn-secondary">Cancel</button>
                            <button id="confirm-transitioning-btn" class="btn btn-primary">Yes, Add Transitioning</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const confirmationModal = document.createElement('div');
        confirmationModal.innerHTML = confirmationHTML;
        document.body.appendChild(confirmationModal);

        document.getElementById('cancel-transitioning-btn').addEventListener('click', () => {
            confirmationModal.remove();
        });

        document.getElementById('confirm-transitioning-btn').addEventListener('click', async () => {
            confirmationModal.remove();
            await addTransitioningStudent();
        });
    }

    async function addTransitioningStudent() {
        const parentName = document.getElementById('new-parent-name').value.trim();
        const parentPhone = document.getElementById('new-parent-phone').value.trim();
        const studentName = document.getElementById('new-student-name').value.trim();
        const studentGrade = document.getElementById('new-student-grade').value.trim();
        
        const selectedSubjects = [];
        document.querySelectorAll('input[name="subjects"]:checked').forEach(checkbox => {
            selectedSubjects.push(checkbox.value);
        });

        const studentDays = document.getElementById('new-student-days').value.trim();
        const groupClass = document.getElementById('new-student-group-class') ? document.getElementById('new-student-group-class').checked : false;
        const studentFee = parseFloat(document.getElementById('new-student-fee').value);

        if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
            showCustomAlert('❌ Please fill in all parent and student details correctly, including at least one subject.');
            return;
        }

        const payScheme = getTutorPayScheme(tutor);
        const suggestedFee = calculateSuggestedFee({
            grade: studentGrade,
            days: studentDays,
            subjects: selectedSubjects,
            groupClass: groupClass
        }, payScheme);

        const studentData = {
            parentName: parentName,
            parentPhone: parentPhone,
            studentName: studentName,
            grade: studentGrade,
            subjects: selectedSubjects,
            days: studentDays,
            studentFee: suggestedFee > 0 ? suggestedFee : studentFee,
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            isTransitioning: true
        };

        if (findSpecializedSubject(selectedSubjects)) {
            studentData.groupClass = groupClass;
        }

        try {
            if (isBypassApprovalEnabled) {
                await addDoc(collection(db, "students"), studentData);
                showCustomAlert('✅ Transitioning student added successfully!');
            } else {
                await addDoc(collection(db, "pending_students"), studentData);
                showCustomAlert('✅ Transitioning student added and is pending approval.');
            }
            renderStudentDatabase(container, tutor);
        } catch (error) {
            console.error("Error adding transitioning student:", error);
            showCustomAlert(`❌ An error occurred: ${error.message}`);
        }
    }

    function attachEventListeners() {
        const subjectsContainer = document.getElementById('new-student-subjects-container');
        const groupClassContainer = document.getElementById('group-class-container');
        
        if (subjectsContainer && groupClassContainer) {
            subjectsContainer.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.checked) {
                    const subject = e.target.value;
                    const hasSpecializedSubject = findSpecializedSubject([subject]);
                    if (hasSpecializedSubject) {
                        groupClassContainer.classList.remove('hidden');
                    }
                }
            });
        }

        const transitioningBtn = document.getElementById('add-transitioning-btn');
        if (transitioningBtn) {
            transitioningBtn.addEventListener('click', () => {
                showTransitioningConfirmation();
            });
        }

        const studentBtn = document.getElementById('add-student-btn');
        if (studentBtn && isTutorAddEnabled) {
            studentBtn.addEventListener('click', async () => {
                const parentName = document.getElementById('new-parent-name').value.trim();
                const parentPhone = document.getElementById('new-parent-phone').value.trim();
                const studentName = document.getElementById('new-student-name').value.trim();
                const studentGrade = document.getElementById('new-student-grade').value.trim();
                
                const selectedSubjects = [];
                document.querySelectorAll('input[name="subjects"]:checked').forEach(checkbox => {
                    selectedSubjects.push(checkbox.value);
                });

                const studentDays = document.getElementById('new-student-days').value.trim();
                const groupClass = document.getElementById('new-student-group-class') ? document.getElementById('new-student-group-class').checked : false;
                const studentFee = parseFloat(document.getElementById('new-student-fee').value);

                if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
                    showCustomAlert('❌ Please fill in all parent and student details correctly, including at least one subject.');
                    return;
                }

                const payScheme = getTutorPayScheme(tutor);
                const suggestedFee = calculateSuggestedFee({
                    grade: studentGrade,
                    days: studentDays,
                    subjects: selectedSubjects,
                    groupClass: groupClass
                }, payScheme);

                const studentData = {
                    parentName: parentName,
                    parentPhone: parentPhone,
                    studentName: studentName,
                    grade: studentGrade,
                    subjects: selectedSubjects,
                    days: studentDays,
                    studentFee: suggestedFee > 0 ? suggestedFee : studentFee,
                    tutorEmail: tutor.email,
                    tutorName: tutor.name
                };

                if (findSpecializedSubject(selectedSubjects)) {
                    studentData.groupClass = groupClass;
                }

                try {
                    if (isBypassApprovalEnabled) {
                        await addDoc(collection(db, "students"), studentData);
                        showCustomAlert('✅ Student added successfully!');
                    } else {
                        await addDoc(collection(db, "pending_students"), studentData);
                        showCustomAlert('✅ Student added and is pending approval.');
                    }
                    renderStudentDatabase(container, tutor);
                } catch (error) {
                    console.error("Error adding student:", error);
                    showCustomAlert(`❌ An error occurred: ${error.message}`);
                }
            });
        }

        document.querySelectorAll('.enter-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                showReportModal(student);
            });
        });

        document.querySelectorAll('.submit-single-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                showReportModal(student);
            });
        });

        document.querySelectorAll('.summer-break-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                
                if (confirm(`Are you sure you want to put ${student.studentName} on Break?`)) {
                    const studentRef = doc(db, "students", studentId);
                    await updateDoc(studentRef, { summerBreak: true });
                    showCustomAlert(`✅ ${student.studentName} has been marked as on Break.`);
                    renderStudentDatabase(container, tutor);
                }
            });
        });

        const submitAllBtn = document.getElementById('submit-all-reports-btn');
        if (submitAllBtn) {
            submitAllBtn.addEventListener('click', () => {
                const reportsToSubmit = Object.values(savedReports);
                showAccountDetailsModal(reportsToSubmit);
            });
        }

        const saveFeeBtn = document.getElementById('save-management-fee-btn');
        if (saveFeeBtn) {
            saveFeeBtn.addEventListener('click', async () => {
                const newFee = parseFloat(document.getElementById('management-fee-input').value);
                if (isNaN(newFee) || newFee < 0) {
                    showCustomAlert("❌ Please enter a valid fee amount.");
                    return;
                }
                const tutorRef = doc(db, "tutors", tutor.id);
                await updateDoc(tutorRef, { managementFee: newFee });
                showCustomAlert("✅ Management fee updated successfully.");
                window.tutorData.managementFee = newFee;
            });
        }
        
        document.querySelectorAll('.edit-student-btn-tutor').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const collectionName = btn.getAttribute('data-collection');
                const student = students.find(s => s.id === studentId && s.collection === collectionName);
                if (student) {
                    showEditStudentModal(student);
                }
            });
        });

        document.querySelectorAll('.delete-student-btn-tutor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const studentId = btn.getAttribute('data-student-id');
                const collectionName = btn.getAttribute('data-collection');
                const student = students.find(s => s.id === studentId && s.collection === collectionName);
                
                if (student && confirm(`Are you sure you want to delete ${student.studentName}? This action cannot be undone.`)) {
                    try {
                        await deleteDoc(doc(db, collectionName, studentId));
                        showCustomAlert('✅ Student deleted successfully!');
                        renderStudentDatabase(container, tutor);
                    } catch (error) {
                        console.error("Error deleting student:", error);
                        showCustomAlert(`❌ An error occurred: ${error.message}`);
                    }
                }
            });
        });
    }

    renderUI();
}

/*******************************************************************************
 * SECTION 13: AUTO-REGISTERED STUDENTS MANAGEMENT
 ******************************************************************************/

// Auto-Registered Students Functions
function renderAutoRegisteredStudents(container, tutor) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2 class="text-2xl font-bold text-blue-700">🆕 Auto-Registered Students</h2>
            </div>
            <div class="card-body">
                <p class="text-sm text-gray-600 mb-4">Students who completed tests and need profile completion</p>
                <div id="auto-students-list">
                    <div class="text-center">
                        <div class="spinner mx-auto mb-2"></div>
                        <p class="text-gray-500">Loading auto-registered students...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadAutoRegisteredStudents(tutor.email);
}

async function loadAutoRegisteredStudents(tutorEmail) {
    const studentsQuery = query(collection(db, "students"), 
        where("tutorEmail", "==", tutorEmail),
        where("autoRegistered", "==", true));
    
    const pendingQuery = query(collection(db, "pending_students"), 
        where("tutorEmail", "==", tutorEmail),
        where("autoRegistered", "==", true));

    try {
        const [studentsSnapshot, pendingSnapshot] = await Promise.all([
            getDocs(studentsQuery),
            getDocs(pendingQuery)
        ]);

        const autoStudents = [
            ...studentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data(), collection: "students" }))
                .filter(student => !['archived', 'graduated', 'transferred'].includes(student.status)),
            ...pendingSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data(), collection: "pending_students" }))
                .filter(student => !['archived', 'graduated', 'transferred'].includes(student.status))
        ];

        renderAutoStudentsList(autoStudents);
    } catch (error) {
        console.error("Error loading auto-registered students:", error);
        document.getElementById('auto-students-list').innerHTML = `
            <div class="text-center">
                <div class="text-red-400 text-4xl mb-3">⚠️</div>
                <h4 class="font-bold text-red-600 mb-2">Failed to Load</h4>
                <p class="text-gray-500">Please check your connection and try again.</p>
            </div>
        `;
    }
}

function renderAutoStudentsList(students) {
    const container = document.getElementById('auto-students-list');
    
    if (students.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <div class="text-gray-400 text-4xl mb-3">👤</div>
                <h4 class="font-bold text-gray-600 mb-2">No Auto-Registered Students</h4>
                <p class="text-gray-500">No students need profile completion.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Test Info</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    students.forEach(student => {
        const status = student.collection === "students" ? 
            "🆕 Needs Completion" : 
            "🆕 Awaiting Approval";
            
        const statusClass = student.collection === "students" ? 
            'badge badge-info' : 
            'badge badge-warning';
        
        html += `
            <tr>
                <td>
                    <div class="font-medium">${student.studentName}</div>
                    <div class="text-sm text-gray-500">${student.grade} • ${student.parentPhone || 'No phone'}</div>
                    <div class="text-xs text-gray-400">${student.parentEmail || 'No email'}</div>
                </td>
                <td>
                    <span class="${statusClass}">
                        ${status}
                    </span>
                </td>
                <td class="text-sm text-gray-500">
                    ${student.testSubject || 'General Test'}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm complete-student-btn" 
                                data-student-id="${student.id}" data-collection="${student.collection}">
                            Complete Profile
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    document.querySelectorAll('.complete-student-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.getAttribute('data-student-id');
            const collection = btn.getAttribute('data-collection');
            const student = students.find(s => s.id === studentId && s.collection === collection);
            if (student) {
                showEditStudentModal(student);
            }
        });
    });
}

/*******************************************************************************
 * SECTION 13A: GAMIFICATION & PERFORMANCE ENGINE
 ******************************************************************************/

// --- CONFIGURATION ---
const GAMIFICATION_CONFIG = {
    confettiDuration: 3000, // 3 seconds
    celebrationFrequency: 'weekly', // 'daily', 'weekly', 'always'
    gradingCriteria: [
        { id: 'attendance', label: 'Punctuality', max: 20 },
        { id: 'student_feedback', label: 'Student Rating', max: 30 },
        { id: 'admin_review', label: 'Admin Assessment', max: 50 }
    ]
};

// --- STATE MANAGEMENT ---
let currentTutorScore = 0;
let isTutorOfTheMonth = false;

/**
 * Initializes the gamification dashboard widget.
 * Call this function when the dashboard loads.
 */
async function initGamification(tutorId) {
    try {
        // 1. Get Current Tutor's Score
        const tutorRef = doc(db, "tutors", tutorId);
        // We use onSnapshot for REAL-TIME updates. 
        // If Admin updates score, Tutor sees it instantly.
        onSnapshot(tutorRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentTutorScore = data.performanceScore || 0;
                updateScoreDisplay(currentTutorScore, data.scoreBreakdown);
            }
        });

        // 2. Check "Tutor of the Month" Status
        checkWinnerStatus(tutorId);

    } catch (error) {
        console.error("Gamification Error:", error);
    }
}

/**
 * Checks if the current user is the winner and handles the celebration logic.
 */
async function checkWinnerStatus(tutorId) {
    try {
        // We assume a central document 'gamification/current_cycle' holds the winner info
        const cycleRef = doc(db, "gamification", "current_cycle");
        const cycleSnap = await getDoc(cycleRef);

        if (cycleSnap.exists()) {
            const data = cycleSnap.data();
            // Data structure: { winnerId: "xyz", month: "October", year: 2023 }
            
            if (data.winnerId === tutorId) {
                isTutorOfTheMonth = true;
                renderWinnerBadge(data.month);
                
                // Logic: Blow confetti if it's the start of the month OR weekly reminder
                // For now, we blow it on every login if they are the winner (High Dopamine)
                triggerConfetti(); 
                showCustomAlert(`🏆 You are the ${data.month} Tutor of the Month!`);
            }
        }
    } catch (error) {
        console.error("Winner Check Error:", error);
    }
}

// --- UI RENDERING FUNCTIONS ---

function updateScoreDisplay(totalScore, breakdown = {}) {
    // Locate the dashboard widget (Create this div in your HTML)
    const scoreWidget = document.getElementById('performance-widget');
    if (!scoreWidget) return;

    // Calculate color based on score
    let scoreColor = 'text-red-500';
    if (totalScore > 50) scoreColor = 'text-yellow-500';
    if (totalScore > 80) scoreColor = 'text-green-500';

    scoreWidget.innerHTML = `
        <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            ${isTutorOfTheMonth ? '<div class="absolute top-0 right-0 bg-yellow-400 text-xs font-bold px-2 py-1 rounded-bl-lg">👑 REIGNING CHAMPION</div>' : ''}
            
            <h3 class="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Performance Score</h3>
            
            <div class="flex items-end gap-2 mb-3">
                <span class="text-4xl font-black ${scoreColor}">${totalScore}</span>
                <span class="text-gray-400 text-sm mb-1">/ 100 pts</span>
            </div>
            
            <div class="space-y-2">
                <div class="w-full bg-gray-100 rounded-full h-2">
                    <div class="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-1000" style="width: ${totalScore}%"></div>
                </div>
                <p class="text-xs text-gray-400 text-right">Updated by Management</p>
            </div>
        </div>
    `;
}

function renderWinnerBadge(month) {
    // Inject a badge into the profile header or sidebar
    const header = document.querySelector('.header-profile-section'); // Adjust selector to match your HTML
    if (header) {
        const badge = document.createElement('div');
        badge.className = 'winner-badge animate-pulse bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full border border-yellow-300 ml-2 flex items-center gap-1';
        badge.innerHTML = `<span>🏆</span> ${month} Top Tutor`;
        header.appendChild(badge);
    }
}

// --- VISUAL FX (Confetti Engine) ---
// No external library needed - Raw Canvas implementation for speed
function triggerConfetti() {
    const duration = 3000;
    const end = Date.now() + duration;

    // Simple confetti shim
    (function frame() {
        // Launch confetti from left and right edges
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

// NOTE: You will need to include the lightweight canvas-confetti script in your HTML head for the FX to work:
// <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>

/*******************************************************************************
 * SECTION 14: ADMIN SETTINGS LISTENER
 ******************************************************************************/

// Listen for changes to admin settings
const settingsDocRef = doc(db, "settings", "global_settings");
onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        isSubmissionEnabled = data.isReportEnabled;
        isTutorAddEnabled = data.isTutorAddEnabled;
        isSummerBreakEnabled = data.isSummerBreakEnabled;
        isBypassApprovalEnabled = data.bypassPendingApproval;
        showStudentFees = data.showStudentFees;
        showEditDeleteButtons = data.showEditDeleteButtons;

        const mainContent = document.getElementById('mainContent');
        if (mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});

/*******************************************************************************
 * SECTION 15: MAIN APP INITIALIZATION (UPDATED)
 ******************************************************************************/

// Main App Initialization
document.addEventListener('DOMContentLoaded', async () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const tutorQuery = query(collection(db, "tutors"), where("email", "==", user.email.trim()));
            const querySnapshot = await getDocs(tutorQuery);
            
            if (!querySnapshot.empty) {
                const tutorDoc = querySnapshot.docs[0];
                const tutorData = { id: tutorDoc.id, ...tutorDoc.data() };
                
                // Check if tutor is inactive (block access)
                if (tutorData.status === 'inactive') {
                    await signOut(auth);
                    document.getElementById('mainContent').innerHTML = `
                        <div class="card">
                            <div class="card-body text-center">
                                <div class="text-red-400 text-4xl mb-3">🚫</div>
                                <h4 class="font-bold text-red-600 mb-2">Account Inactive</h4>
                                <p class="text-gray-500 mb-4">Your tutor account has been marked as inactive.</p>
                                <p class="text-sm text-gray-500">Please contact management for assistance.</p>
                                <a href="tutor-auth.html" class="btn btn-primary mt-4">Return to Login</a>
                            </div>
                        </div>`;
                    return;
                }
                
                window.tutorData = tutorData;
                
                if (shouldShowEmploymentPopup(tutorData)) {
                    showEmploymentDatePopup(tutorData);
                }
                
                if (shouldShowTINPopup(tutorData)) {
                    showTINPopup(tutorData);
                }
                
                renderTutorDashboard(document.getElementById('mainContent'), tutorData);
                
                // Initialize floating messaging and inbox buttons
                setTimeout(() => {
                    initializeFloatingMessagingButton();
                    updateUnreadMessageCount(); // Check for unread messages
                    
                    // Set up periodic refresh of unread count (every 30 seconds)
                    setInterval(updateUnreadMessageCount, 30000);
                }, 1000);
                
                setTimeout(async () => {
                    await checkAndShowSchedulePopup(tutorData);
                }, 2000);
            } else {
                console.error("No matching tutor found.");
                document.getElementById('mainContent').innerHTML = `
                    <div class="card">
                        <div class="card-body text-center">
                            <div class="text-red-400 text-4xl mb-3">⚠️</div>
                            <h4 class="font-bold text-red-600 mb-2">Error: No Tutor Profile Found</h4>
                            <p class="text-gray-500">No tutor profile found for your email.</p>
                        </div>
                    </div>`;
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'tutor-auth.html';
            }).catch(error => {
                console.error("Error signing out:", error);
                showCustomAlert('❌ Error signing out. Please try again.');
            });
        });
    }

    // Navigation event listeners
    const addNavListener = (id, renderFunction) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', () => {
                if (window.tutorData) {
                    renderFunction(document.getElementById('mainContent'), window.tutorData);
                    // Ensure floating buttons stay visible
                    setTimeout(() => {
                        if (!document.querySelector('.floating-messaging-btn')) {
                            initializeFloatingMessagingButton();
                        }
                        updateUnreadMessageCount();
                    }, 100);
                }
            });
        }
    };

    addNavListener('navDashboard', renderTutorDashboard);
    addNavListener('navStudentDatabase', renderStudentDatabase);
    addNavListener('navAutoStudents', renderAutoRegisteredStudents);
    
    // Add inbox navigation to the sidebar if it exists
    setTimeout(() => {
        const navInbox = document.getElementById('navInbox');
        if (!navInbox) {
            // Create inbox navigation item if it doesn't exist
            const sidebar = document.querySelector('.sidebar-nav');
            if (sidebar) {
                const inboxNav = document.createElement('li');
                inboxNav.id = 'navInbox';
                inboxNav.innerHTML = `
                    <a href="#" class="nav-link flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <span class="text-xl">📨</span>
                        <span>Inbox</span>
                    </a>
                `;
                sidebar.appendChild(inboxNav);
                
                inboxNav.addEventListener('click', () => {
                    if (window.tutorData) {
                        showInboxModal();
                    }
                });
            }
        }
    }, 500);
});
