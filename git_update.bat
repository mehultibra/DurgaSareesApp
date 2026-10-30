@echo off
cd /d "w:\Mehul Work\Scripts\DurgaSareesApp"
git add www/app.js www/index.html www/style.css www/pdf_engine.js
git commit -m "Support mobile multi-image selection and clarify desktop folder upload"
git push origin main
