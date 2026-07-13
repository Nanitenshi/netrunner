// js/enhancements.js — explicit entry point for optional, dependency-free UI
// hardening modules. Keeping them together makes the core game graph easier to
// audit and lets every enhancement fail independently without blocking boot.
import "./crewOverlayMobile.js?v=5192bf4c";
import "./overworldPolish.js?v=5192bf4c";
import "./shopPolish.js?v=5192bf4c";
import "./saveTools.js?v=5192bf4c";
import "./qualityPass.js?v=5192bf4c";
