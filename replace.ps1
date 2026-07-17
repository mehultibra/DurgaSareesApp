 = Get-Content "www\app_v22.js" -Raw
 = "var filename = `{item.docId}___$}{item.designId}___$}{safeName}___$}{item.ts}.jpg`;
            try {
                var uploadStartTime = Date.now();
                var fileData = await Capacitor.Plugins.Filesystem.readFile({ path: item.fileUri });
                var res = await fetch(`data:image/jpeg;base64,$}{fileData.data}`);
                var blob = await res.blob();

                var uploadUrl = `https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o?name=Uploads%2FRaw%2F` + encodeURIComponent(filename);

                var uploadRes = await window.fetchWithRetry(uploadUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: blob
                }, 1);

                if (uploadRes.ok) {
                    await window.deleteFromOutbox(item.id);
                    var uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
                    var totalJourney = ((Date.now() - item.ts) / 1000).toFixed(2);
                    window.logAppError('Upload Success', `File: $}{filename} | Net Time: $}{uploadDuration}s | Total Journey: $}{totalJourney}s`);
                    console.log(`? Successfully uploaded: $}{filename} in $}{uploadDuration}s`);
                } else {
                    throw new Error(`Status $}{uploadRes.status}`);
                }
            } catch (err) {"

 = "var filename = `{item.docId}___$}{item.designId}___$}{safeName}___$}{item.ts}.jpg`;
            try {
                var uploadStartTime = Date.now();
                var fileData = await Capacitor.Plugins.Filesystem.readFile({ path: item.fileUri });
                var res = await fetch(`data:image/jpeg;base64,$}{fileData.data}`);
                var blob = await res.blob();

                if (item.bypass) {
                    var pMatch = window.allProducts ? window.allProducts.find(x => x.docId === item.docId) : null;
                    if (!pMatch) throw new Error("Product not found for bypass multi-folder upload");

                    var folders = [];
                    if (pMatch.gridUrl && pMatch.gridUrl.toLowerCase() !== "none") folders.push(pMatch.gridUrl);
                    if (pMatch.zoomUrl && pMatch.zoomUrl.toLowerCase() !== "none") folders.push(pMatch.zoomUrl);
                    if (pMatch.gridUrl) folders.push(pMatch.gridUrl.replace(/\/Grid\/?/i, "/Thumb"));

                    folders = [...new Set(folders)];
                    if (folders.length === 0) throw new Error("No active Firebase folders resolved");

                    var uploadPromises = folders.map(folderUrl => {
                        var cleanFolder = String(folderUrl).trim().replace(/\\/g, '/').split('/').filter(Boolean).map(s => encodeURIComponent(s.trim())).join('%2F');
                        var destUrl = `https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o?name=` + cleanFolder + `%2F` + encodeURIComponent(item.designId + ".jpg");
                        
                        return window.fetchWithRetry(destUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'image/jpeg' },
                            body: blob
                        }, 1);
                    });

                    var results = await Promise.all(uploadPromises);
                    var allOk = results.every(r => r.ok);

                    if (allOk) {
                        await window.deleteFromOutbox(item.id);
                        var uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
                        window.logAppError('Upload Success', `Bypass multi-folder: $}{filename}`);
                        console.log(`? Successfully uploaded bypass to $}{folders.length} folders in $}{uploadDuration}s`);
                    } else {
                        throw new Error("One or more bypass multi-folder uploads failed");
                    }
                } else {
                    var uploadUrl = `https://firebasestorage.googleapis.com/v0/b/durga-sarees.firebasestorage.app/o?name=Uploads%2FRaw%2F` + encodeURIComponent(filename);

                    var uploadRes = await window.fetchWithRetry(uploadUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'image/jpeg' },
                        body: blob
                    }, 1);

                    if (uploadRes.ok) {
                        await window.deleteFromOutbox(item.id);
                        var uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
                        var totalJourney = ((Date.now() - item.ts) / 1000).toFixed(2);
                        window.logAppError('Upload Success', `File: $}{filename} | Net Time: $}{uploadDuration}s | Total Journey: $}{totalJourney}s`);
                        console.log(`? Successfully uploaded: $}{filename} in $}{uploadDuration}s`);
                    } else {
                        throw new Error(`Status $}{uploadRes.status}`);
                    }
                }
            } catch (err) {"

 = .Replace(, )
Set-Content "www\app_v22.js" 
