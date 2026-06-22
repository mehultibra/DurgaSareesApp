package com.durgasarees.catalog;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean webCanGoBack = false;

    public void setWebCanGoBack(boolean canGoBack) {
        this.webCanGoBack = canGoBack;
    }

    public static class WebAppInterface {
        private MainActivity activity;

        public WebAppInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void setCanGoBack(boolean canGoBack) {
            activity.setWebCanGoBack(canGoBack);
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = null;
        if (bridge != null) {
            webView = bridge.getWebView();
        }
        if (webView != null) {
            webView.addJavascriptInterface(new WebAppInterface(this), "AndroidBridge");
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



