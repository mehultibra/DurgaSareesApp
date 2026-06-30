package com.durgasarees.catalog;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static MainActivity instance;
    private boolean webCanGoBack = false;

    public static MainActivity getInstance() {
        return instance;
    }

    public void setWebCanGoBack(boolean canGoBack) {
        this.webCanGoBack = canGoBack;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        instance = this;
        registerPlugin(AndroidBackBridgePlugin.class);
        super.onCreate(savedInstanceState);

        enforceLightNavBar();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final WebView view = (bridge != null) ? bridge.getWebView() : null;
                if (webCanGoBack) {
                    if (view != null) {
                        view.post(() -> view.evaluateJavascript("window.history.back();", null));
                    }
                } else if (view != null && view.canGoBack()) {
                    view.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }

    private void enforceLightNavBar() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            getWindow().setNavigationBarColor(android.graphics.Color.WHITE);
            getWindow().getInsetsController().setSystemBarsAppearance(
                android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            );
        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getWindow().setNavigationBarColor(android.graphics.Color.WHITE);
            android.view.View decorView = getWindow().getDecorView();
            int flags = decorView.getSystemUiVisibility();
            flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            decorView.setSystemUiVisibility(flags);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        enforceLightNavBar();
    }

    @Override
    public void onResume() {
        super.onResume();
        enforceLightNavBar();
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enforceLightNavBar();
        }
    }
}
