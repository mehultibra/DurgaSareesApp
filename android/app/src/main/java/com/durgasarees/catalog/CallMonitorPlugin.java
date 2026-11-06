package com.durgasarees.catalog;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallMonitor")
public class CallMonitorPlugin extends Plugin {
    private static boolean isEnabled = false;

    @PluginMethod
    public void enable(PluginCall call) {
        isEnabled = true;
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        isEnabled = false;
        call.resolve();
    }

    public static boolean isMonitorEnabled() {
        return isEnabled;
    }
}

