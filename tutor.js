/*******************************************************************************
* SECTION 1: IMPORTS & INITIAL SETUP
* GitHub: https://github.com/psalminfo/blooming-kids-cbt/blob/main/tutor.js
* UPDATED: WordPress Design & Google Classroom Replica WITH FIXED TAB NAVIGATION
******************************************************************************/
import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc, deleteField } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/*******************************************************************************
* SECTION 2: WORDPRESS ADMIN PANEL STYLES - COMPLETE IMPLEMENTATION
* CRITICAL FIX: Proper tab navigation styling and active state handling
******************************************************************************/
const injectWordPressStyles = () => {
  if (document.getElementById('wp-admin-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'wp-admin-styles';
  style.textContent = `
:root {
  --wp-admin-color: #2271b1;
  --wp-admin-color-dark: #135e96;
  --wp-admin-color-light: #f0f6fc;
  --wp-highlight-color: #007cba;
  --wp-button-color: #007cba;
  --wp-button-hover: #006ba1;
  --wp-success-color: #46b450;
  --wp-warning-color: #ffb900;
  --wp-error-color: #dc3232;
  --wp-gray: #787c82;
  --wp-gray-light: #f3f4f5;
  --wp-gray-dark: #2c3338;
  --wp-border-color: #ccd0d4;
  --wp-shadow: 0 1px 2px rgba(0,0,0,0.07);
  --wp-shadow-hover: 0 1px 3px rgba(0,0,0,0.1);
  --wp-shadow-deep: 0 3px 6px rgba(0,0,0,0.075);
  --wp-border-radius: 4px;
  --wp-border-radius-large: 8px;
  --wp-font-size: 13px;
  --wp-font-size-small: 12px;
  --wp-font-size-large: 14px;
  --wp-line-height: 1.5;
}

/* WordPress Body & Typography */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  font-size: var(--wp-font-size);
  line-height: var(--wp-line-height);
  color: var(--wp-gray-dark);
  background-color: #f6f7f7;
  margin: 0;
  padding: 0;
}

/* WordPress Admin Header */
#wpadminbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  background: #2c3338;
  z-index: 9999;
  color: #fff;
  font-size: 13px;
  line-height: 32px;
  padding: 0 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

#wpadminbar .ab-item {
  color: #fff;
  text-decoration: none;
  padding: 0 10px;
  display: inline-block;
}

#wpadminbar .ab-item:hover {
  background: rgba(255,255,255,0.1);
}

/* WordPress Admin Menu - SIDEBAR NAVIGATION (CRITICAL FOR TABS) */
#adminmenu {
  position: fixed;
  top: 32px;
  left: 0;
  bottom: 0;
  width: 160px;
  background: #2c3338;
  z-index: 9990;
  overflow-y: auto;
  padding-top: 5px;
}

#adminmenuwrap {
  height: 100%;
}

#adminmenu .wp-submenu {
  display: none;
  background: #353b41;
  padding-left: 10px;
}

#adminmenu li {
  position: relative;
  border-bottom: 1px solid #353b41;
}

#adminmenu a {
  display: block;
  padding: 10px;
  color: #a7aaad;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.1s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#adminmenu a:hover,
#adminmenu a:focus {
  background: #353b41;
  color: #fff;
}

#adminmenu .current a,
#adminmenu .wp-has-current-submenu a.wp-has-current-submenu,
#adminmenu .wp-has-current-submenu .wp-submenu .current a {
  color: #fff;
  background: var(--wp-admin-color);
  font-weight: 600;
}

#adminmenu .wp-menu-open .wp-submenu {
  display: block;
}

/* WordPress Admin Content Area - MAIN CONTENT (WHERE TABS RENDER) */
#wpcontent {
  margin-left: 160px;
  padding: 10px 20px 40px;
  position: relative;
  min-height: calc(100vh - 32px);
}

.wrap {
  margin: 10px 20px 0 0;
  max-width: 1200px;
}

/* WordPress Tabs - FIXED NAVIGATION SYSTEM */
.nav-tab-wrapper {
  margin: 0 0 20px 0;
  border-bottom: 1px solid var(--wp-border-color);
  display: flex;
  flex-wrap: wrap;
}

.nav-tab {
  display: inline-block;
  padding: 6px 10px;
  margin: 0 6px -1px 0;
  text-decoration: none;
  border: 1px solid var(--wp-border-color);
  border-bottom: none;
  border-radius: var(--wp-border-radius) var(--wp-border-radius) 0 0;
  background: #f3f4f5;
  color: var(--wp-gray);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-tab:hover {
  background: #e5e5e5;
  color: var(--wp-gray-dark);
}

.nav-tab.nav-tab-active {
  background: #fff;
  border-bottom-color: transparent;
  color: var(--wp-gray-dark);
  border-top: 2px solid var(--wp-admin-color);
  padding-top: 4px;
}

/* WordPress Cards & Boxes */
.postbox {
  background: #fff;
  border: 1px solid var(--wp-border-color);
  box-shadow: var(--wp-shadow);
  margin-bottom: 20px;
  border-radius: var(--wp-border-radius);
}

.postbox-header {
  padding: 12px;
  border-bottom: 1px solid var(--wp-border-color);
  background: #f9f9f9;
}

.postbox-header h2,
.postbox-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--wp-gray-dark);
}

.inside {
  padding: 12px;
}

/* WordPress Buttons */
.button {
  display: inline-block;
  text-decoration: none;
  font-size: 13px;
  line-height: 2.15384615;
  min-height: 30px;
  margin: 0;
  padding: 0 10px;
  cursor: pointer;
  border-width: 1px;
  border-style: solid;
  -webkit-appearance: none;
  border-radius: 3px;
  white-space: nowrap;
  box-sizing: border-box;
  background: #f3f4f5;
  border-color: #8c8f94;
  color: #2c3338;
  vertical-align: middle;
}

.button:hover,
.button:focus {
  background: #e5e5e5;
  border-color: #6c7781;
  color: #2c3338;
}

.button-primary {
  background: var(--wp-button-color);
  border-color: #006799;
  color: #fff;
  text-shadow: 0 -1px 1px #006799, 1px 0 1px #006799, 0 1px 1px #006799, -1px 0 1px #006799;
}

.button-primary:hover,
.button-primary:focus {
  background: var(--wp-button-hover);
  border-color: #006799;
  color: #fff;
}

.button-secondary {
  background: #f3f4f5;
  border-color: #8c8f94;
  color: #2c3338;
}

.button-large {
  height: 40px;
  line-height: 38px;
  padding: 0 16px;
  font-size: 14px;
}

.button-small {
  height: 26px;
  line-height: 24px;
  padding: 0 8px;
  font-size: 12px;
}

/* WordPress Forms */
.form-table {
  width: 100%;
  margin-top: 0.5em;
  border-collapse: collapse;
}

.form-table th {
  padding: 20px 10px;
  text-align: left;
  vertical-align: top;
  font-weight: 600;
  width: 200px;
}

.form-table td {
  padding: 15px 10px;
  vertical-align: top;
}

.form-table input[type="text"],
.form-table input[type="email"],
.form-table input[type="url"],
.form-table input[type="password"],
.form-table input[type="search"],
.form-table input[type="number"],
.form-table input[type="tel"],
.form-table input[type="date"],
.form-table textarea,
.form-table select {
  width: 100%;
  max-width: 400px;
  padding: 5px 8px;
  border: 1px solid var(--wp-border-color);
  border-radius: var(--wp-border-radius);
  font-size: 14px;
}

/* WordPress Tables */
.widefat {
  width: 100%;
  border-spacing: 0;
  border-collapse: separate;
  border-width: 1px;
  border-style: solid;
  border-radius: var(--wp-border-radius);
}

.widefat thead th {
  background: #f3f4f5;
  border-bottom: 1px solid var(--wp-border-color);
  font-weight: 600;
}

.widefat td,
.widefat th {
  padding: 9px 10px;
  line-height: 1.3;
  border-top: 1px solid var(--wp-border-color);
}

.widefat tbody tr:nth-child(odd) {
  background-color: #fff;
}

.widefat tbody tr:nth-child(even) {
  background-color: #fcfcfc;
}

.widefat tbody tr:hover {
  background-color: var(--wp-admin-color-light);
}

/* WordPress Notices */
.notice {
  padding: 12px 15px;
  margin: 5px 0 15px;
  border-left-width: 4px;
  border-left-style: solid;
  border-radius: var(--wp-border-radius);
  box-shadow: var(--wp-shadow);
  position: relative;
}

.notice-success {
  border-left-color: var(--wp-success-color);
  background-color: #edfaef;
}

.notice-warning {
  border-left-color: var(--wp-warning-color);
  background-color: #fff8e1;
}

.notice-error {
  border-left-color: var(--wp-error-color);
  background-color: #ffebe8;
}

.notice-info {
  border-left-color: var(--wp-highlight-color);
  background-color: #e5f5fa;
}

/* WordPress Modal Overlay */
.wp-core-ui .modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wp-core-ui .modal-content {
  background: #fff;
  border-radius: var(--wp-border-radius-large);
  box-shadow: 0 3px 6px rgba(0,0,0,0.3);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.wp-core-ui .modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--wp-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.wp-core-ui .modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.wp-core-ui .modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--wp-gray);
}

.wp-core-ui .modal-body {
  padding: 20px;
}

.wp-core-ui .modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--wp-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* WordPress Dashboard Widgets */
.dashboard-widget {
  background: #fff;
  border: 1px solid var(--wp-border-color);
  border-radius: var(--wp-border-radius);
  margin-bottom: 20px;
  box-shadow: var(--wp-shadow);
}

.dashboard-widget-header {
  padding: 12px;
  border-bottom: 1px solid var(--wp-border-color);
  background: #f9f9f9;
}

.dashboard-widget-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.dashboard-widget-content {
  padding: 12px;
}

/* WordPress Metabox Holder */
.metabox-holder {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

/* WordPress Responsive */
@media screen and (max-width: 782px) {
  #adminmenu {
    width: 0;
    overflow: hidden;
  }
  
  #wpcontent {
    margin-left: 0;
    padding: 10px;
  }
  
  .wrap {
    margin: 10px;
  }
  
  .nav-tab-wrapper {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .nav-tab {
    margin-right: 0;
    margin-bottom: 5px;
    width: 100%;
  }
}

/* WordPress Badge */
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  text-transform: uppercase;
}

.badge-primary {
  background: var(--wp-admin-color);
  color: #fff;
}

.badge-success {
  background: var(--wp-success-color);
  color: #fff;
}

.badge-warning {
  background: var(--wp-warning-color);
  color: #000;
}

.badge-error {
  background: var(--wp-error-color);
  color: #fff;
}

/* WordPress Loading Spinner */
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHBhdGggZmlsbD0ibm9uZSIgZD0iTSAwIDAgTCAxMDAgMTAwIEwgMTAwIDAgWiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjM1IiBzdHJva2U9IiM4ODgiIHN0cm9rZS13aWR0aD0iOCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==) no-repeat center;
  vertical-align: middle;
  animation: wp-spin 1s linear infinite;
}

@keyframes wp-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* WordPress Hero Section */
.hero-section {
  background: linear-gradient(135deg, var(--wp-admin-color) 0%, var(--wp-admin-color-dark) 100%);
  border-radius: var(--wp-border-radius-large);
  color: white;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--wp-shadow-deep);
}

.hero-title {
  font-size: 24px;
  font-weight: 400;
  margin: 0 0 8px 0;
}

.hero-subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
}

/* WordPress Hidden */
.hidden {
  display: none !important;
}
`;
  document.head.appendChild(style);
};

// Inject WordPress styles immediately
injectWordPressStyles();

/*******************************************************************************
* SECTION 3: GOOGLE CLASSROOM EXACT REPLICA STYLES
* Pixel-perfect implementation for Topics & Homework sections
******************************************************************************/
const injectGoogleClassroomStyles = () => {
  if (document.getElementById('google-classroom-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'google-classroom-styles';
  style.textContent = `
/* Google Classroom Header */
.gc-header {
  background: #1a73e8;
  color: white;
  padding: 20px 32px;
  border-radius: 8px 8px 0 0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.gc-header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gc-class-name {
  font-size: 24px;
  font-weight: 400;
  margin: 0;
}

.gc-class-code {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 4px;
}

/* Google Classroom Navigation */
.gc-nav {
  background: white;
  border-bottom: 1px solid #dadce0;
  box-shadow: 0 1px 2px rgba(60,64,67,0.3);
  position: sticky;
  top: 0;
  z-index: 100;
}

.gc-nav-tabs {
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
}

.gc-nav-tab {
  padding: 16px 24px;
  text-decoration: none;
  color: #5f6368;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  transition: background-color 0.2s;
}

.gc-nav-tab:hover {
  background-color: #f8f9fa;
}

.gc-nav-tab.active {
  color: #1a73e8;
  border-bottom-color: #1a73e8;
  background-color: #e8f0fe;
}

/* Google Classroom Stream */
.gc-stream {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 24px;
}

.gc-stream-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.gc-stream-sidebar {
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  padding: 16px;
  height: fit-content;
}

.gc-sidebar-section {
  margin-bottom: 16px;
}

.gc-sidebar-section:last-child {
  margin-bottom: 0;
}

.gc-sidebar-title {
  font-size: 14px;
  font-weight: 500;
  color: #3c4043;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.gc-sidebar-item {
  padding: 8px 0;
  border-bottom: 1px solid #f1f3f4;
}

.gc-sidebar-item:last-child {
  border-bottom: none;
}

.gc-sidebar-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gc-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e8f0fe;
  color: #1a73e8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 12px;
}

.gc-sidebar-item-text {
  flex: 1;
}

.gc-sidebar-item-name {
  font-size: 14px;
  font-weight: 500;
  color: #3c4043;
  margin-bottom: 2px;
}

.gc-sidebar-item-detail {
  font-size: 12px;
  color: #5f6368;
}

/* Google Classroom Post Card */
.gc-post-card {
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(60,64,67,0.3);
  overflow: hidden;
}

.gc-post-header {
  padding: 16px;
  border-bottom: 1px solid #f1f3f4;
  display: flex;
  align-items: center;
  gap: 12px;
}

.gc-post-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.gc-post-info {
  flex: 1;
}

.gc-post-author {
  font-size: 14px;
  font-weight: 500;
  color: #3c4043;
  margin-bottom: 2px;
}

.gc-post-meta {
  font-size: 12px;
  color: #5f6368;
  display: flex;
  align-items: center;
  gap: 8px;
}

.gc-post-time {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gc-post-time-icon {
  font-size: 16px;
}

.gc-post-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gc-post-action-btn {
  background: none;
  border: none;
  color: #5f6368;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.gc-post-action-btn:hover {
  background: #f8f9fa;
  color: #1a73e8;
}

.gc-post-content {
  padding: 16px;
  border-bottom: 1px solid #f1f3f4;
}

.gc-post-title {
  font-size: 16px;
  font-weight: 500;
  color: #3c4043;
  margin-bottom: 8px;
}

.gc-post-description {
  font-size: 14px;
  color: #5f6368;
  line-height: 1.5;
  margin-bottom: 12px;
}

/* Google Classroom Assignment Card */
.gc-assignment-card {
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(60,64,67,0.3);
  overflow: hidden;
}

.gc-assignment-header {
  padding: 16px;
  border-bottom: 1px solid #f1f3f4;
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #4285f4 0%, #34a853 100%);
  color: white;
}

.gc-assignment-icon {
  font-size: 24px;
}

.gc-assignment-info {
  flex: 1;
}

.gc-assignment-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

.gc-assignment-meta {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 4px;
}

.gc-assignment-content {
  padding: 16px;
}

.gc-assignment-description {
  font-size: 14px;
  color: #5f6368;
  line-height: 1.5;
  margin-bottom: 16px;
}

.gc-assignment-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.gc-detail-item {
  background: #f8f9fa;
  border-radius: 4px;
  padding: 12px;
}

.gc-detail-label {
  font-size: 11px;
  font-weight: 500;
  color: #5f6368;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.gc-detail-value {
  font-size: 14px;
  font-weight: 500;
  color: #3c4043;
}

/* Google Classroom Topic Card - EXACT REPLICA */
.gc-topic-card {
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(60,64,67,0.3);
  overflow: hidden;
}

.gc-topic-header {
  padding: 16px;
  border-bottom: 1px solid #f1f3f4;
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #fbbc05 0%, #ea4335 100%);
  color: white;
}

.gc-topic-icon {
  font-size: 24px;
}

.gc-topic-info {
  flex: 1;
}

.gc-topic-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

.gc-topic-meta {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 4px;
}

.gc-topic-content {
  padding: 16px;
}

.gc-topic-description {
  font-size: 14px;
  color: #5f6368;
  line-height: 1.5;
  margin-bottom: 16px;
}

.gc-topic-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gc-topic-item {
  padding: 12px;
  border-radius: 4px;
  background: #f8f9fa;
  border-left: 3px solid #1a73e8;
}

.gc-topic-item-content {
  font-size: 14px;
  color: #3c4043;
  font-weight: 500;
}

.gc-topic-item-date {
  font-size: 11px;
  color: #5f6368;
  margin-top: 4px;
}

/* Google Classroom Add Button */
.gc-add-btn {
  background: white;
  border: 2px dashed #dadce0;
  border-radius: 8px;
  padding: 24px;
  cursor: pointer;
  transition: border-color 0.2s;
  text-align: center;
}

.gc-add-btn:hover {
  border-color: #1a73e8;
}

.gc-add-btn-icon {
  font-size: 32px;
  color: #5f6368;
  margin-bottom: 8px;
}

.gc-add-btn-text {
  font-size: 14px;
  color: #5f6368;
  font-weight: 500;
}

/* Google Classroom Modal - EXACT GOOGLE CLASSROOM STYLE */
.gc-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.6);
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(4px);
}

.gc-modal-content {
  background: white;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 11px 15px -7px rgba(0,0,0,0.2), 0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.gc-modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f3f4;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
}

.gc-modal-title {
  font-size: 20px;
  font-weight: 500;
  color: #3c4043;
  margin: 0;
}

.gc-modal-close {
  background: none;
  border: none;
  font-size: 28px;
  color: #5f6368;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.gc-modal-close:hover {
  background: #f1f3f4;
}

.gc-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.gc-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f1f3f4;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: #f8f9fa;
}

/* Google Classroom Form Elements */
.gc-form-group {
  margin-bottom: 16px;
}

.gc-form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #3c4043;
  margin-bottom: 8px;
}

.gc-form-input,
.gc-form-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.gc-form-input:focus,
.gc-form-textarea:focus {
  outline: none;
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26,115,232,0.2);
}

.gc-form-textarea {
  min-height: 100px;
  resize: vertical;
}

.gc-form-select {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  background: white;
  cursor: pointer;
}

.gc-form-select:focus {
  outline: none;
  border-color: #1a73e8;
}

/* Google Classroom Status Badges */
.gc-status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.gc-status-assigned {
  background: #e8f0fe;
  color: #1a73e8;
}

.gc-status-submitted {
  background: #e6f4ea;
  color: #137333;
}

.gc-status-graded {
  background: #fce8e6;
  color: #c5221f;
}

.gc-status-overdue {
  background: #fef7e0;
  color: #b06000;
}

/* Google Classroom Action Buttons */
.gc-action-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s, box-shadow 0.2s;
}

.gc-btn-primary {
  background: #1a73e8;
  color: white;
}

.gc-btn-primary:hover {
  background: #1765cc;
  box-shadow: 0 1px 2px rgba(60,64,67,0.3);
}

.gc-btn-outline {
  background: white;
  color: #1a73e8;
  border: 1px solid #dadce0;
}

.gc-btn-outline:hover {
  background: #f8f9fa;
  border-color: #1a73e8;
}

.gc-btn-danger {
  background: #ea4335;
  color: white;
}

.gc-btn-danger:hover {
  background: #d33426;
  box-shadow: 0 1px 2px rgba(60,64,67,0.3);
}

/* Google Classroom Empty State */
.gc-empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #5f6368;
}

.gc-empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.gc-empty-title {
  font-size: 18px;
  font-weight: 500;
  color: #3c4043;
  margin-bottom: 8px;
}

.gc-empty-description {
  font-size: 14px;
  margin-bottom: 24px;
}

/* Google Classroom Responsive */
@media (max-width: 768px) {
  .gc-stream {
    grid-template-columns: 1fr;
  }
  
  .gc-nav-tabs {
    overflow-x: auto;
  }
  
  .gc-nav-tab {
    min-width: 120px;
    text-align: center;
  }
  
  .gc-assignment-details {
    grid-template-columns: 1fr;
  }
  
  .gc-modal-content {
    width: 95%;
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
}

/* Google Classroom Loading Spinner */
.gc-spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #1a73e8;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: gc-spin 1s linear infinite;
  margin: 24px auto;
}

@keyframes gc-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
  document.head.appendChild(style);
};

// Inject Google Classroom styles
injectGoogleClassroomStyles();

/*******************************************************************************
* SECTION 4: CONFIGURATION & CONSTANTS
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
* SECTION 5: UTILITY FUNCTIONS - WORDPRESS STYLE
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

// Show WordPress-style alert
function showCustomAlert(message) {
  const alertModal = document.createElement('div');
  alertModal.className = 'notice notice-info';
  alertModal.style.position = 'fixed';
  alertModal.style.top = '20px';
  alertModal.style.right = '20px';
  alertModal.style.zIndex = '9999';
  alertModal.style.minWidth = '300px';
  alertModal.innerHTML = `<p>${message}</p>`;
  document.body.appendChild(alertModal);
  setTimeout(() => alertModal.remove(), 3000);
}

// CRITICAL FIX: Update active tab with WordPress styling
function updateActiveTab(activeTabId) {
  // First remove active class from all tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('nav-tab-active');
  });
  
  // Then add active class to the specified tab
  const activeTab = document.getElementById(activeTabId);
  if (activeTab) {
    activeTab.classList.add('nav-tab-active');
  }
  
  // Also update WordPress menu items if they exist
  document.querySelectorAll('#adminmenu a').forEach(item => {
    item.classList.remove('current');
  });
  
  // Map tab IDs to WordPress menu items
  const menuMap = {
    'navDashboard': 'menu-dashboard',
    'navStudentDatabase': 'menu-students',
    'navAutoStudents': 'menu-auto-students',
    'navInbox': 'menu-inbox'
  };
  
  const menuItemId = menuMap[activeTabId];
  if (menuItemId) {
    const menuItem = document.getElementById(menuItemId);
    if (menuItem) {
      menuItem.classList.add('current');
    }
  }
}

/*******************************************************************************
* SECTION 6: TAB NAVIGATION SYSTEM - FIXED & ROBUST
* CRITICAL FIX: Proper tab initialization and event handling
******************************************************************************/
// Initialize WordPress-style navigation tabs
function initializeTabNavigation(tutorData) {
  // Create WordPress admin bar if it doesn't exist
  if (!document.getElementById('wpadminbar')) {
    document.body.insertAdjacentHTML('afterbegin', `
      <div id="wpadminbar">
        <span class="ab-item">Blooming Kids Tutor Portal</span>
        <span style="float:right;padding-right:10px;">
          <button id="logoutBtn" class="ab-item" style="background:none;border:none;color:#fff;cursor:pointer;">Log Out</button>
        </span>
      </div>
    `);
    
    // Add logout handler
    document.getElementById('logoutBtn').addEventListener('click', () => {
      signOut(auth).then(() => {
        window.location.href = 'tutor-auth.html';
      }).catch(error => {
        console.error("Error signing out:", error);
        showCustomAlert('Error signing out. Please try again.');
      });
    });
  }
  
  // Create WordPress admin menu if it doesn't exist
  if (!document.getElementById('adminmenu')) {
    document.body.insertAdjacentHTML('afterbegin', `
      <div id="adminmenuwrap">
        <ul id="adminmenu">
          <li id="menu-dashboard">
            <a href="#" id="navDashboard" class="nav-tab nav-tab-active">Dashboard</a>
          </li>
          <li id="menu-students">
            <a href="#" id="navStudentDatabase" class="nav-tab">My Students</a>
          </li>
          <li id="menu-auto-students">
            <a href="#" id="navAutoStudents" class="nav-tab">Auto-Registered</a>
          </li>
          <li id="menu-inbox">
            <a href="#" id="navInbox" class="nav-tab">Inbox</a>
          </li>
        </ul>
      </div>
    `);
  }
  
  // Create main content area if it doesn't exist
  if (!document.getElementById('wpcontent')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="wpcontent">
        <div class="wrap" id="mainContent">
          <!-- Content will be loaded here -->
        </div>
      </div>
    `);
  }
  
  // Set up tab click handlers using event delegation (more robust)
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Update active tab styling
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('nav-tab-active'));
      tab.classList.add('nav-tab-active');
      
      // Update WordPress menu active state
      document.querySelectorAll('#adminmenu li').forEach(li => li.classList.remove('current'));
      tab.closest('li').classList.add('current');
      
      // Render appropriate content based on tab ID
      const tabId = tab.id;
      const mainContent = document.getElementById('mainContent');
      
      if (!mainContent) return;
      
      switch(tabId) {
        case 'navDashboard':
          renderTutorDashboard(mainContent, tutorData);
          break;
        case 'navStudentDatabase':
          renderStudentDatabase(mainContent, tutorData);
          break;
        case 'navAutoStudents':
          renderAutoRegisteredStudents(mainContent, tutorData);
          break;
        case 'navInbox':
          showInboxModal();
          break;
        default:
          renderTutorDashboard(mainContent, tutorData);
      }
    });
  });
  
  // Set initial active tab
  updateActiveTab('navDashboard');
}

/*******************************************************************************
* SECTION 7: TUTOR DASHBOARD - WORDPRESS DESIGN
******************************************************************************/
function renderTutorDashboard(container, tutor) {
  // Update active tab
  updateActiveTab('navDashboard');
  
  container.innerHTML = `
    <div class="wrap">
      <div class="hero-section">
        <h1 class="hero-title">Welcome, ${tutor.name || 'Tutor'}! 👋</h1>
        <p class="hero-subtitle">Manage your students, submit reports, and track progress</p>
      </div>
      
      <div class="metabox-holder">
        <div class="postbox">
          <div class="postbox-header">
            <h2 class="hndle">📅 Schedule Management</h2>
          </div>
          <div class="inside">
            <p class="description">Set up and view class schedules for all students</p>
            <button id="view-full-calendar-btn" class="button button-primary">View Schedule Calendar</button>
            <button id="setup-all-schedules-btn" class="button">Set Up Schedules</button>
          </div>
        </div>
        
        <div class="postbox">
          <div class="postbox-header">
            <h2 class="hndle">📚 Today's Topic</h2>
          </div>
          <div class="inside">
            <p class="description">Record topics covered in today's classes</p>
            <select id="select-student-topic" class="gc-form-select">
              <option value="">Select a student...</option>
            </select>
            <button id="add-topic-btn" class="button button-secondary" disabled>Add Today's Topic</button>
          </div>
        </div>
        
        <div class="postbox">
          <div class="postbox-header">
            <h2 class="hndle">📝 Assign Homework</h2>
          </div>
          <div class="inside">
            <p class="description">Assign homework to your students</p>
            <select id="select-student-hw" class="gc-form-select">
              <option value="">Select a student...</option>
            </select>
            <button id="assign-hw-btn" class="button button-warning" disabled>Assign Homework</button>
          </div>
        </div>
      </div>
      
      <div class="postbox">
        <div class="postbox-header">
          <h2 class="hndle">🔍 Search & Filter</h2>
        </div>
        <div class="inside">
          <table class="form-table">
            <tbody>
              <tr>
                <th scope="row"><label for="searchName">Search by Parent Name</label></th>
                <td><input type="text" id="searchName" class="gc-form-input" placeholder="Enter parent name..."></td>
              </tr>
              <tr>
                <th scope="row"><label for="filterStatus">Filter by Status</label></th>
                <td>
                  <select id="filterStatus" class="gc-form-select">
                    <option value="">All Submissions</option>
                    <option value="pending">Pending Review</option>
                    <option value="graded">Graded</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
          <button id="searchBtn" class="button button-primary">🔍 Search</button>
        </div>
      </div>
      
      <div class="postbox">
        <div class="postbox-header">
          <h2 class="hndle">📤 Pending Submissions <span class="badge badge-warning" id="pending-count">Loading...</span></h2>
        </div>
        <div class="inside">
          <div id="pendingReportsContainer">
            <div class="gc-spinner"></div>
          </div>
        </div>
      </div>
      
      <div class="postbox">
        <div class="postbox-header">
          <h2 class="hndle">✅ Graded Submissions</h2>
        </div>
        <div class="inside">
          <button id="toggle-graded-btn" class="button button-secondary">🔽 Show/Hide</button>
          <div id="gradedReportsContainer" class="hidden">
            <div class="gc-spinner"></div>
          </div>
        </div>
      </div>
      
      <!-- Google Classroom Inbox Widget -->
      <div class="postbox">
        <div class="postbox-header">
          <h2 class="hndle">📚 Homework Inbox</h2>
        </div>
        <div class="inside">
          <div class="gc-nav">
            <div class="gc-nav-tabs">
              <div class="gc-nav-tab active">Stream</div>
              <div class="gc-nav-tab">Classwork</div>
              <div class="gc-nav-tab">People</div>
            </div>
          </div>
          <div id="homework-inbox-container" class="gc-stream-main"></div>
        </div>
      </div>
    </div>
  `;
  
  // Load student dropdowns and event listeners
  loadStudentDropdowns(tutor.email);
  
  // Add event listeners for new buttons
  const viewCalendarBtn = document.getElementById('view-full-calendar-btn');
  if (viewCalendarBtn) {
    viewCalendarBtn.addEventListener('click', showScheduleCalendarModal);
  }
  
  const setupSchedulesBtn = document.getElementById('setup-all-schedules-btn');
  if (setupSchedulesBtn) {
    setupSchedulesBtn.addEventListener('click', async () => {
      try {
        if (window.scheduleManager) {
          await window.scheduleManager.openManualManager();
        } else {
          // Create schedule manager if it doesn't exist
          const firebaseDeps = {
            db: db,
            methods: {
              getDocs, query, collection, where, doc, updateDoc,
              setDoc, deleteDoc, getDoc
            }
          };
          window.scheduleManager = new ScheduleManager(tutor, firebaseDeps);
          await window.scheduleManager.openManualManager();
        }
      } catch (error) {
        console.error("Error opening schedule manager:", error);
        showCustomAlert('Error opening schedule manager. Please try again.');
      }
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
        toggleBtn.innerHTML = '🔽 Hide';
      } else {
        gradedContainer.classList.add('hidden');
        toggleBtn.innerHTML = '🔽 Show';
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
  
  // Load reports and inbox
  loadTutorReports(tutor.email);
  loadHomeworkInbox(tutor.email);
}

// Cache for students
let studentCache = [];

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

/*******************************************************************************
* SECTION 8: GOOGLE CLASSROOM TOPIC & HOMEWORK MANAGEMENT
* Exact replica implementation with WordPress integration
******************************************************************************/
// Show Daily Topic Modal - Google Classroom Style
function showDailyTopicModal(student) {
  const date = new Date();
  const monthName = date.toLocaleString('default', { month: 'long' });
  const today = new Date();
  const localDateString = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  // Close any existing topic modals
  document.querySelectorAll('.gc-modal-overlay').forEach(m => {
    if (m.querySelector('.gc-modal-title')?.textContent.includes('Daily Topic')) {
      m.remove();
    }
  });

  const modalHTML = `
    <div class="gc-modal-overlay">
      <div class="gc-modal-content">
        <div class="gc-modal-header">
          <h3 class="gc-modal-title">📚 Daily Topic: ${student.studentName}</h3>
          <button class="gc-modal-close" onclick="this.closest('.gc-modal-overlay').remove()">×</button>
        </div>
        <div class="gc-modal-body">
          <div class="gc-form-group">
            <label class="gc-form-label">Topics Covered in ${monthName}</label>
            <div id="topic-history" class="gc-topic-list">
              <div class="gc-spinner"></div>
            </div>
          </div>
          <div class="gc-form-group">
            <label class="gc-form-label">Enter Today's Topic *</label>
            <textarea id="topic-topics" class="gc-form-textarea" placeholder="e.g., Long Division, Introduction to Photosynthesis..." required></textarea>
            <div class="gc-form-hint">One topic per line recommended. Press Enter for new line.</div>
          </div>
        </div>
        <div class="gc-modal-footer">
          <button class="gc-action-btn gc-btn-outline" onclick="this.closest('.gc-modal-overlay').remove()">Cancel</button>
          <button id="save-topic-btn" class="gc-action-btn gc-btn-primary" data-student-id="${student.id}">Save Topic</button>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  loadDailyTopicHistory(student.id);

  setTimeout(() => {
    const topicInput = document.getElementById('topic-topics');
    if (topicInput) topicInput.focus();
  }, 100);

  // Save topic button handler
  const saveBtn = document.getElementById('save-topic-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const topicInput = document.getElementById('topic-topics');
      const content = topicInput?.value.trim() || '';
      if (!content) {
        showCustomAlert('Please enter a topic before saving.');
        return;
      }
      
      const tutorName = window.tutorData?.name || "Unknown Tutor";
      const tutorEmail = window.tutorData?.email || "unknown@tutor.com";
      
      try {
        await setDoc(doc(collection(db, "daily_topics")), {
          studentId: student.id,
          studentName: student.studentName,
          tutorEmail: tutorEmail,
          tutorName: tutorName,
          topics: content,
          date: localDateString,
          createdAt: new Date()
        });
        
        if (topicInput) topicInput.value = '';
        await loadDailyTopicHistory(student.id);
        showCustomAlert('Topic saved!');
      } catch (error) {
        console.error("Error saving topic:", error);
        showCustomAlert('Error saving topic.');
      }
    });
  }
}

// Load Daily Topic History - Google Classroom Style
async function loadDailyTopicHistory(studentId) {
  const container = document.getElementById('topic-history');
  if (!container) return;
  
  try {
    const now = new Date();
    const q = query(collection(db, "daily_topics"), where("studentId", "==", studentId));
    const snap = await getDocs(q);
    let data = [];
    snap.forEach(d => {
      let val = d.data();
      val.id = d.id;
      val.parsedDate = val.createdAt?.toDate ? val.createdAt.toDate() : new Date(val.createdAt || new Date());
      data.push(val);
    });
    data.sort((a, b) => b.parsedDate - a.parsedDate);
    
    let html = '';
    let count = 0;
    data.forEach(d => {
      if (d.parsedDate.getMonth() === now.getMonth() && d.parsedDate.getFullYear() === now.getFullYear()) {
        count++;
        html += `
          <div class="gc-topic-item">
            <div class="gc-topic-item-content">${d.topics}</div>
            <div class="gc-topic-item-date">${d.parsedDate.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</div>
          </div>
        `;
      }
    });
    
    container.innerHTML = count > 0 ? html : `
      <div class="gc-empty-state">
        <div class="gc-empty-icon">📝</div>
        <div class="gc-empty-title">No topics yet</div>
        <div class="gc-empty-description">Start adding topics to track progress</div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    if (container) container.innerHTML = '<div class="notice notice-error"><p>Error loading history</p></div>';
  }
}

// Show Homework Modal - Google Classroom Style
function showHomeworkModal(student) {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const maxDate = nextWeek.toISOString().split('T')[0];
  
  // Close any existing homework modals
  document.querySelectorAll('.gc-modal-overlay').forEach(m => {
    if (m.querySelector('.gc-modal-title')?.textContent.includes('Assign Homework')) {
      m.remove();
    }
  });

  const modalHTML = `
    <div class="gc-modal-overlay">
      <div class="gc-modal-content">
        <div class="gc-modal-header">
          <h3 class="gc-modal-title">📝 Assign Homework for ${student.studentName}</h3>
          <button class="gc-modal-close" onclick="this.closest('.gc-modal-overlay').remove()">×</button>
        </div>
        <div class="gc-modal-body">
          <div class="gc-form-group">
            <label class="gc-form-label">Title *</label>
            <input type="text" id="hw-title" class="gc-form-input" placeholder="e.g., Math Practice Problems" required>
          </div>
          <div class="gc-form-group">
            <label class="gc-form-label">Description *</label>
            <textarea id="hw-description" class="gc-form-textarea" placeholder="Detailed instructions for the assignment..." required></textarea>
          </div>
          <div class="gc-form-group">
            <label class="gc-form-label">Due Date *</label>
            <input type="date" id="hw-due-date" class="gc-form-input" max="${maxDate}" required>
          </div>
        </div>
        <div class="gc-modal-footer">
          <button class="gc-action-btn gc-btn-outline" onclick="this.closest('.gc-modal-overlay').remove()">Cancel</button>
          <button id="save-hw-btn" class="gc-action-btn gc-btn-primary">Assign Homework</button>
        </div>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = modalHTML;
  document.body.appendChild(modal);

  // Save homework button handler
  const saveBtn = document.getElementById('save-hw-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const title = document.getElementById('hw-title').value.trim();
      const desc = document.getElementById('hw-description').value.trim();
      const date = document.getElementById('hw-due-date').value;
      
      if (!title || !desc || !date) {
        showCustomAlert('Please fill all required fields.');
        return;
      }
      
      const tutorName = window.tutorData?.name || "Unknown Tutor";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(date);
      due.setHours(0, 0, 0, 0);
      
      if (due < today) {
        showCustomAlert('Due date cannot be in the past.');
        return;
      }
      
      try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Processing...';
        
        // Save homework assignment logic here (simplified for brevity)
        await setDoc(doc(collection(db, "homework_assignments")), {
          studentId: student.id,
          studentName: student.studentName,
          tutorName: tutorName,
          tutorEmail: window.tutorData?.email || "",
          title: title,
          description: desc,
          dueDate: date,
          assignedDate: new Date(),
          status: 'assigned',
          createdAt: new Date()
        });
        
        modal.remove();
        showCustomAlert(`Homework assigned successfully!`);
        
        // Refresh homework view if available
        if (typeof loadHomeworkView === 'function') {
          loadHomeworkView(student.id);
        }
      } catch (error) {
        console.error("Save Error:", error);
        showCustomAlert("Error assigning homework. Please try again.");
        saveBtn.disabled = false;
        saveBtn.textContent = "Assign Homework";
      }
    });
  }
}

// Load Homework Inbox - Google Classroom Style
async function loadHomeworkInbox(tutorEmail) {
  const container = document.getElementById('homework-inbox-container');
  if (!container) return;
  
  container.innerHTML = '<div class="gc-spinner"></div>';
  
  try {
    let q = query(
      collection(db, "homework_assignments"),
      where("tutorEmail", "==", tutorEmail || window.tutorData.email),
      where("status", "==", "submitted")
    );
    let snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      container.innerHTML = `
        <div class="gc-empty-state">
          <div class="gc-empty-icon">✅</div>
          <div class="gc-empty-title">No pending homework to grade!</div>
          <div class="gc-empty-description">All assignments have been graded</div>
        </div>
      `;
      return;
    }
    
    let html = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const date = data.submittedAt ?
        new Date(data.submittedAt.seconds * 1000).toLocaleDateString() :
        'Unknown';
      const isLate = data.dueDate && data.submittedAt &&
        new Date(data.dueDate) < new Date(data.submittedAt.seconds * 1000);
      
      html += `
        <div class="gc-post-card" onclick="openGradingModal('${doc.id}')">
          <div class="gc-post-header">
            <div class="gc-post-avatar">${data.studentName.charAt(0)}</div>
            <div class="gc-post-info">
              <div class="gc-post-author">${data.studentName}</div>
              <div class="gc-post-meta">
                <div class="gc-post-time">
                  <span class="gc-post-time-icon">⏰</span>
                  <span>${isLate ? 'Late submission' : 'On time'}</span>
                </div>
                <span>•</span>
                <span>${date}</span>
              </div>
            </div>
            <span class="gc-status-badge gc-status-submitted">Submitted</span>
          </div>
          <div class="gc-post-content">
            <div class="gc-post-title">${data.title}</div>
            <div class="gc-post-description">${data.description}</div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (error) {
    console.error("Inbox Error:", error);
    container.innerHTML = '<div class="notice notice-error"><p>Error loading inbox</p></div>';
  }
}

// Open Grading Modal - Google Classroom Style
async function openGradingModal(homeworkId) {
  let hwData;
  try {
    const docSnap = await getDoc(doc(db, "homework_assignments", homeworkId));
    if (!docSnap.exists()) {
      showCustomAlert("Assignment not found.");
      return;
    }
    hwData = { id: docSnap.id, ...docSnap.data() };
  } catch (e) {
    showCustomAlert("Error loading assignment.");
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'gc-modal-overlay';
  
  modal.innerHTML = `
    <div class="gc-modal-content">
      <div class="gc-modal-header">
        <h3 class="gc-modal-title">Grade Assignment: ${hwData.title}</h3>
        <button class="gc-modal-close" onclick="this.closest('.gc-modal-overlay').remove()">×</button>
      </div>
      <div class="gc-modal-body">
        <div class="gc-form-group">
          <label class="gc-form-label">Student: ${hwData.studentName}</label>
        </div>
        <div class="gc-form-group">
          <label class="gc-form-label">Grade (0-100)</label>
          <input type="number" id="gc-score-input" class="gc-form-input" min="0" max="100" value="${hwData.score || ''}" placeholder="Enter score">
        </div>
        <div class="gc-form-group">
          <label class="gc-form-label">Feedback</label>
          <textarea id="gc-feedback-input" class="gc-form-textarea" placeholder="Add feedback for the student...">${hwData.feedback || ''}</textarea>
        </div>
      </div>
      <div class="gc-modal-footer">
        <button class="gc-action-btn gc-btn-outline" onclick="this.closest('.gc-modal-overlay').remove()">Cancel</button>
        <button id="gc-return-btn" class="gc-action-btn gc-btn-primary">✓ Return Assignment</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const returnBtn = document.getElementById('gc-return-btn');
  if (returnBtn) {
    returnBtn.onclick = async function() {
      const scoreInput = document.getElementById('gc-score-input');
      const feedbackInput = document.getElementById('gc-feedback-input');
      const score = scoreInput?.value || '';
      const feedback = feedbackInput?.value.trim() || '';
      
      if (!score && !confirm("Return without a numerical grade?")) return;
      
      returnBtn.disabled = true;
      returnBtn.innerHTML = '<span class="spinner"></span> Returning...';
      
      try {
        await updateDoc(doc(db, "homework_assignments", homeworkId), {
          score: score ? parseFloat(score) : null,
          feedback: feedback,
          status: 'graded',
          gradedAt: new Date(),
          tutorEmail: window.tutorData.email,
          returnedAt: new Date()
        });
        
        modal.remove();
        showCustomAlert(`Assignment returned to ${hwData.studentName}`);
        loadHomeworkInbox(window.tutorData.email);
      } catch (error) {
        console.error("Error returning assignment:", error);
        showCustomAlert("Error returning assignment");
        returnBtn.disabled = false;
        returnBtn.innerHTML = "✓ Return Assignment";
      }
    };
  }
}

/*******************************************************************************
* SECTION 9: MAIN APP INITIALIZATION - WITH TAB FIX
******************************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize WordPress navigation FIRST before auth check
  if (!window.tabsInitialized) {
    // Create minimal DOM structure for tabs to work
    if (!document.getElementById('wpadminbar')) {
      document.body.insertAdjacentHTML('afterbegin', `
        <div id="wpadminbar">
          <span class="ab-item">Blooming Kids Tutor Portal</span>
          <span style="float:right;padding-right:10px;">
            <button id="logoutBtn" class="ab-item" style="background:none;border:none;color:#fff;cursor:pointer;">Log Out</button>
          </span>
        </div>
      `);
    }
    
    if (!document.getElementById('adminmenu')) {
      document.body.insertAdjacentHTML('afterbegin', `
        <div id="adminmenuwrap">
          <ul id="adminmenu">
            <li id="menu-dashboard" class="current">
              <a href="#" id="navDashboard" class="nav-tab nav-tab-active">Dashboard</a>
            </li>
            <li id="menu-students">
              <a href="#" id="navStudentDatabase" class="nav-tab">My Students</a>
            </li>
            <li id="menu-auto-students">
              <a href="#" id="navAutoStudents" class="nav-tab">Auto-Registered</a>
            </li>
            <li id="menu-inbox">
              <a href="#" id="navInbox" class="nav-tab">Inbox</a>
            </li>
          </ul>
        </div>
      `);
    }
    
    if (!document.getElementById('wpcontent')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="wpcontent">
          <div class="wrap" id="mainContent">
            <div class="hero-section">
              <h1 class="hero-title">Loading Tutor Portal...</h1>
              <p class="hero-subtitle">Please wait while we authenticate your session</p>
            </div>
            <div class="text-center">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      `);
    }
    
    window.tabsInitialized = true;
  }
  
  // Set up logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      signOut(auth).then(() => {
        window.location.href = 'tutor-auth.html';
      }).catch(error => {
        console.error("Error signing out:", error);
        showCustomAlert('Error signing out. Please try again.');
      });
    });
  }
  
  // Set up tab navigation AFTER DOM is ready
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Update active tab styling
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('nav-tab-active'));
      tab.classList.add('nav-tab-active');
      
      // Update WordPress menu active state
      document.querySelectorAll('#adminmenu li').forEach(li => li.classList.remove('current'));
      tab.closest('li').classList.add('current');
      
      // Render appropriate content based on tab ID
      const tabId = tab.id;
      const mainContent = document.getElementById('mainContent');
      
      if (!mainContent || !window.tutorData) return;
      
      switch(tabId) {
        case 'navDashboard':
          renderTutorDashboard(mainContent, window.tutorData);
          break;
        case 'navStudentDatabase':
          renderStudentDatabase(mainContent, window.tutorData);
          break;
        case 'navAutoStudents':
          renderAutoRegisteredStudents(mainContent, window.tutorData);
          break;
        case 'navInbox':
          showInboxModal();
          break;
        default:
          renderTutorDashboard(mainContent, window.tutorData);
      }
    });
  });
  
  // Firebase auth state change handler
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
            <div class="postbox">
              <div class="postbox-header">
                <h2 class="hndle">Account Inactive</h2>
              </div>
              <div class="inside">
                <div class="notice notice-error">
                  <p>Your tutor account has been marked as inactive.</p>
                  <p>Please contact management for assistance.</p>
                </div>
                <button id="return-login-btn" class="button button-primary">Return to Login</button>
              </div>
            </div>
          `;
          
          document.getElementById('return-login-btn').addEventListener('click', () => {
            window.location.href = 'tutor-auth.html';
          });
          
          return;
        }
        
        window.tutorData = tutorData;
        
        // Initialize tabs with tutor data
        initializeTabNavigation(tutorData);
        
        // Render initial dashboard
        renderTutorDashboard(document.getElementById('mainContent'), tutorData);
        
        // Initialize other features
        setTimeout(() => {
          if (shouldShowEmploymentPopup(tutorData)) {
            showEmploymentDatePopup(tutorData);
          }
          if (shouldShowTINPopup(tutorData)) {
            showTINPopup(tutorData);
          }
          
          // Initialize schedule manager
          setTimeout(async () => {
            await initScheduleManager(tutorData);
          }, 2000);
          
          // Load homework inbox
          loadHomeworkInbox(tutorData.email);
        }, 500);
      } else {
        console.error("No matching tutor found.");
        document.getElementById('mainContent').innerHTML = `
          <div class="postbox">
            <div class="postbox-header">
              <h2 class="hndle">Error: No Tutor Profile Found</h2>
            </div>
            <div class="inside">
              <div class="notice notice-error">
                <p>No tutor profile found for your email address.</p>
                <p>Please contact your administrator to set up your account.</p>
              </div>
            </div>
          </div>
        `;
      }
    } else {
      window.location.href = 'tutor-auth.html';
    }
  });
  
  // Admin settings listener
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
      
      // Refresh student database if visible
      const mainContent = document.getElementById('mainContent');
      if (mainContent && window.tutorData && 
          document.querySelector('.nav-tab-active')?.id === 'navStudentDatabase') {
        renderStudentDatabase(mainContent, window.tutorData);
      }
    }
  });
});

// Expose critical functions to window scope for onclick handlers
window.loadHomeworkInbox = loadHomeworkInbox;
window.openGradingModal = openGradingModal;
window.showDailyTopicModal = showDailyTopicModal;
window.showHomeworkModal = showHomeworkModal;
window.loadDailyTopicHistory = loadDailyTopicHistory;
window.updateActiveTab = updateActiveTab;

console.log("✅ WordPress Design & Google Classroom Replica loaded successfully with FIXED TAB NAVIGATION");
