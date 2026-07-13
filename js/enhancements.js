// js/enhancements.js — explicit entry point for optional, dependency-free UI
// hardening modules. Keeping them together makes the core game graph easier to
// audit and lets every enhancement fail independently without blocking boot.
import "./crewOverlayMobile.js";
import "./overworldPolish.js";
import "./shopPolish.js";
import "./qualityPass.js";
