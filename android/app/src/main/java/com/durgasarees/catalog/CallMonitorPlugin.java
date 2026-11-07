package com.durgasarees.catalog;

import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallMonitor")
public class CallMonitorPlugin extends Plugin {
    private static volatile boolean isEnabled = false;
    private static CallMonitorPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
    }

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

    @PluginMethod
    public void requestCallerIdRole(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                RoleManager rm = (RoleManager) getContext().getSystemService(Context.ROLE_SERVICE);
                if (rm != null) {
                    if (rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                        JSObject ret = new JSObject();
                        ret.put("status", "already_granted");
                        ret.put("held", true);
                        call.resolve(ret);
                        return;
                    }
                    Intent intent = rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING);
                    startActivityForResult(call, intent, "callScreeningRoleCallback");
                    return;
                }
            }
            JSObject ret = new JSObject();
            ret.put("status", "unsupported");
            ret.put("held", false);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("requestCallerIdRole error: " + t.getMessage());
        }
    }

    @com.getcapacitor.annotation.ActivityCallback
    private void callScreeningRoleCallback(PluginCall call, androidx.activity.result.ActivityResult result) {
        try {
            boolean held = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                RoleManager rm = (RoleManager) getContext().getSystemService(Context.ROLE_SERVICE);
                held = rm != null && rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING);
            }
            JSObject ret = new JSObject();
            ret.put("status", held ? "granted" : "denied");
            ret.put("held", held);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("Callback error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void requestCallScreeningRole(PluginCall call) {
        requestCallerIdRole(call);
    }

    @PluginMethod
    public void getLastDetectedCall(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            String phone = sp.getString("last_call_phone", null);
            String dir = sp.getString("last_call_dir", "incoming");
            long timestamp = sp.getLong("last_call_time", 0);

            JSObject ret = new JSObject();
            long now = System.currentTimeMillis();
            // Return call if within last 15 minutes
            if (phone != null && !phone.isEmpty() && (now - timestamp < 15 * 60 * 1000)) {
                ret.put("phone", phone);
                ret.put("direction", dir);
                ret.put("timestamp", timestamp);
                ret.put("ageMs", now - timestamp);
            } else {
                ret.put("phone", null);
            }
            call.resolve(ret);
        } catch (Throwable t) {
            JSObject ret = new JSObject();
            ret.put("phone", null);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void clearLastDetectedCall(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            sp.edit().remove("last_call_phone").remove("last_call_dir").remove("last_call_time").apply();
            call.resolve();
        } catch (Throwable t) {
            call.resolve();
        }
    }

    public static void notifyLiveCall(Context context, String phone, String direction) {
        try {
            if (context != null) {
                SharedPreferences sp = context.getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
                sp.edit()
                    .putString("last_call_phone", phone)
                    .putString("last_call_dir", direction)
                    .putLong("last_call_time", System.currentTimeMillis())
                    .apply();
            }

            if (instance != null && instance.getBridge() != null && instance.getBridge().getWebView() != null) {
                instance.getBridge().getWebView().post(() -> {
                    try {
                        String js = "window.dispatchEvent(new CustomEvent('dsNativeCallDetected', { detail: { phone: '" + phone + "', direction: '" + direction + "' } }));";
                        instance.getBridge().getWebView().evaluateJavascript(js, null);
                    } catch (Throwable ignored) {}
                });
            }
        } catch (Throwable ignored) {}
    }

    public static boolean isMonitorEnabled() {
        return isEnabled;
    }
}
