package com.durgasarees.catalog;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import android.util.Base64;
import android.util.Log;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = null;
                if (bridge != null) {
                    webView = bridge.getWebView();
                }
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });

        // Add custom JS interface
        if (bridge != null) {
            WebView webView = bridge.getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
            }
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String getFilesDir() {
            try {
                File dir = getExternalFilesDir(null);
                if (dir != null) {
                    return dir.getAbsolutePath();
                }
            } catch (Exception e) {
                Log.e("AndroidBridge", "Error getting files dir", e);
            }
            return MainActivity.this.getFilesDir().getAbsolutePath();
        }

        @JavascriptInterface
        public boolean saveImage(String filename, String base64Data) {
            try {
                File dir = getExternalFilesDir(null);
                if (dir == null) {
                    dir = MainActivity.this.getFilesDir();
                }
                if (!dir.exists()) {
                    dir.mkdirs();
                }
                File file = new File(dir, filename);
                byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
                FileOutputStream os = new FileOutputStream(file);
                os.write(decodedBytes);
                os.close();
                Log.d("AndroidBridge", "Saved file: " + file.getAbsolutePath());
                return true;
            } catch (Exception e) {
                Log.e("AndroidBridge", "Error saving file: " + filename, e);
                return false;
            }
        }
    }
}

