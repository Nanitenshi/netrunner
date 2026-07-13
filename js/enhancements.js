// js/enhancements.js — explicit entry point for optional, dependency-free UI
// hardening modules. Keeping them together makes the core game graph easier to
// audit and lets every enhancement fail independently without blocking boot.
import "./crewOverlayMobile.js?v=fb969d67";
import "./overworldPolish.js?v=fb969d67";
import "./shopPolish.js?v=fb969d67";
import "./saveTools.js?v=fb969d67";
import "./qualityPass.js?v=fb969d67";
