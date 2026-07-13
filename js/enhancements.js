// js/enhancements.js — explicit entry point for optional, dependency-free UI
// hardening modules. Keeping them together makes the core game graph easier to
// audit and lets every enhancement fail independently without blocking boot.
import "./crewOverlayMobile.js?v=423ba706";
import "./overworldPolish.js?v=423ba706";
import "./shopPolish.js?v=423ba706";
import "./qualityPass.js?v=423ba706";
