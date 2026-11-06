package com.durgasarees.catalog;

import android.content.Context;
import android.media.AudioManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallMonitor")
public class CallMonitorPlugin extends Plugin {
    private static volatile boolean isEnabled = false;

    @PluginMethod
    public void enable(PluginCall call) {
        try {
            isEnabled = true;
            call.resolve();
        } catch (Throwable t) {
            call.reject("CallMonitor enable error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        try {
            isEnabled = false;
            call.resolve();
        } catch (Throwable t) {
            call.reject("CallMonitor disable error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void getCallState(PluginCall call) {
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            int mode = am != null ? am.getMode() : AudioManager.MODE_NORMAL;
            boolean isInCall = (mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION);
            JSObject ret = new JSObject();
            ret.put("isInCall", isInCall);
            ret.put("mode", mode);
            call.resolve(ret);
        } catch (Throwable t) {
            JSObject ret = new JSObject();
            ret.put("isInCall", false);
            ret.put("mode", 0);
            call.resolve(ret);
        }
    }

    public static boolean isMonitorEnabled() {
        return isEnabled;
    }
}
