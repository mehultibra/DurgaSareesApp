package com.durgasarees.catalog;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidBackBridge")
public class AndroidBackBridgePlugin extends Plugin {
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
