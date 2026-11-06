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
        try {
            instance = this;
            registerPlugin(AndroidBackBridgePlugin.class);
            registerPlugin(NativeSpeechPlugin.class);
            registerPlugin(NativeContactsPlugin.class);
            registerPlugin(CallMonitorPlugin.class);
        } catch (Throwable t) {
            // Ignore plugin registration errors
        }

        super.onCreate(savedInstanceState);

        try {
            enforceLightNavBar();
        } catch (Throwable t) {}

        try {
            getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    try {
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
                    } catch (Throwable t) {}
                }
            });
        } catch (Throwable t) {}
    }

    @SuppressWarnings("deprecation")
    private void enforceLightNavBar() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                if (getWindow() != null && getWindow().getInsetsController() != null) {
                    getWindow().getInsetsController().setSystemBarsAppearance(
                        android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                        android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                    );
                }
            } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                if (getWindow() != null) {
                    android.view.View decorView = getWindow().getDecorView();
                    if (decorView != null) {
                        int flags = decorView.getSystemUiVisibility();
                        flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        decorView.setSystemUiVisibility(flags);
                    }
                }
            }
        } catch (Throwable t) {}
    }

    @Override
    public void onStart() {
        super.onStart();
        try {
            enforceLightNavBar();
        } catch (Throwable t) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            enforceLightNavBar();
            if (bridge != null) {
                bridge.triggerWindowJSEvent("dsNativeAppResumed");
            }
        } catch (Throwable t) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        try {
            if (hasFocus) {
                enforceLightNavBar();
            }
        } catch (Throwable t) {}
    }
}
