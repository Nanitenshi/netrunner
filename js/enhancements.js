// js/enhancements.js — explicit entry point for optional, dependency-free UI
// hardening modules. Keeping them together makes the core game graph easier to
// audit and lets every enhancement fail independently without blocking boot.
import "./crewOverlayMobile.js?v=e277f022";
import "./overworldPolish.js?v=e277f022";
import "./shopPolish.js?v=e277f022";
import "./qualityPass.js?v=e277f022";
