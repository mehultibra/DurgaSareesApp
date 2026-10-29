@echo off
cd /d "w:\Mehul Work\Scripts\DurgaSareesApp"
git add www/app.js www/index.html www/style.css www/pdf_engine.js
git commit -m "Implement final audit fixes and Admin Bulk Folder Importer"
git push origin main
