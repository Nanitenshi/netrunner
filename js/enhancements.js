// js/enhancements.js — explicit entry point for optional, dependency-free UI
// hardening modules. Keeping them together makes the core game graph easier to
// audit and lets every enhancement fail independently without blocking boot.
import "./crewOverlayMobile.js?v=260111c3";
import "./overworldPolish.js?v=260111c3";
import "./shopPolish.js?v=260111c3";
import "./qualityPass.js?v=260111c3";
