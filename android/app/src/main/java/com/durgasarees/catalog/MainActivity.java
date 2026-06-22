package com.durgasarees.catalog;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    private static MainActivity instance;
    private boolean webCanGoBack = false;

    public static MainActivity getInstance() {
        return instance;
    }

    public void setWebCanGoBack(boolean canGoBack) {
        this.webCanGoBack = canGoBack;
    }

    @CapacitorPlugin(name = "AndroidBackBridge")
    public static class AndroidBackBridgePlugin extends Plugin {
        @PluginMethod
        public void setCanGoBack(PluginCall call) {
            boolean canGoBack = call.getBoolean("canGoBack", false);
            MainActivity activity = MainActivity.getInstance();
            if (activity != null) {
                activity.setWebCanGoBack(canGoBack);
            }
            call.resolve();
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        instance = this;
        registerPlugin(AndroidBackBridgePlugin.class);
        super.onCreate(savedInstanceState);

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




