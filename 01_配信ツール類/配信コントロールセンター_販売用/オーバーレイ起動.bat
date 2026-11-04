@echo off
start chrome.exe --new-window "http://localhost:8085/overlay.html" 2>nul || start msedge.exe --new-window "http://localhost:8085/overlay.html"
