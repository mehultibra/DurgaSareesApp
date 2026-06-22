package com.durgasarees.catalog;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean webCanGoBack = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = null;
        if (bridge != null) {
            webView = bridge.getWebView();
        }
        if (webView != null) {
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void setCanGoBack(boolean canGoBack) {
                    webCanGoBack = canGoBack;
                }
            }, "AndroidBridge");
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView view = null;
                if (bridge != null) {
                    view = bridge.getWebView();
                }
                if (view != null && (webCanGoBack || view.canGoBack())) {
                    view.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }
}


