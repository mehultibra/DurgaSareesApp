package com.durgasarees.catalog;

import android.Manifest;
import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(
    name = "CallMonitor",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class CallMonitorPlugin extends Plugin {
    private static volatile boolean isEnabled = false;
    private static CallMonitorPlugin instance;
    private static volatile java.util.Map<String, String> sErpCallerCache = null;
    private static volatile long sErpCacheLastModified = -1L;

    private static synchronized void invalidateErpCallerCache() {
        sErpCallerCache = null;
        sErpCacheLastModified = -1L;
    }

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
    public void setPopupEnabled(PluginCall call) {
        try {
            boolean enabled = call.getBoolean("enabled", true);
            SharedPreferences sp = getContext().getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            sp.edit().putBoolean("call_popup_enabled", enabled).apply();
            call.resolve();
        } catch (Throwable t) {
            call.reject("setPopupEnabled error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void setSuperAdmin(PluginCall call) {
        try {
            boolean isSuper = call.getBoolean("isSuperAdmin", false);
            SharedPreferences sp = getContext().getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            sp.edit().putBoolean("is_super_admin", isSuper).apply();
            if (!isSuper) {
                invalidateErpCallerCache();
                DurgaCallScreeningService.clearCallerDatabase(getContext());
                try { getContext().getSharedPreferences("ds_erp_directory", Context.MODE_PRIVATE).edit().clear().apply(); } catch (Throwable ignored) {}
                try { FirebaseMessaging.getInstance().unsubscribeFromTopic(DurgaMessagingService.TOPIC_SUPER_ADMIN); } catch (Throwable ignored) {}
            } else {
                try { FirebaseMessaging.getInstance().subscribeToTopic(DurgaMessagingService.TOPIC_SUPER_ADMIN); } catch (Throwable ignored) {}
            }
            call.resolve();
        } catch (Throwable t) {
            call.reject("setSuperAdmin error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "adminNotifPermsCallback");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("requestNotificationPermission error: " + t.getMessage());
        }
    }

    @PermissionCallback
    private void adminNotifPermsCallback(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void showNewUserNotification(PluginCall call) {
        try {
            String title = call.getString("title", "🆕 New User Logged In");
            String body = call.getString("body", "Tap to link party and assign B2B pricing");
            String phone = call.getString("phone", "");
            DurgaMessagingService.showNewUserNotification(getContext(), title, body, phone);
            call.resolve();
        } catch (Throwable t) {
            call.reject("showNewUserNotification error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void consumePendingAdminRoute(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            boolean openLive = sp.getBoolean("pending_open_live_admin", false);
            String phone = sp.getString("pending_open_live_admin_phone", "");
            if (openLive) {
                sp.edit().remove("pending_open_live_admin").remove("pending_open_live_admin_phone").apply();
            }
            JSObject ret = new JSObject();
            ret.put("openLiveAdmin", openLive);
            ret.put("phone", phone);
            call.resolve(ret);
        } catch (Throwable t) {
            JSObject ret = new JSObject();
            ret.put("openLiveAdmin", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void syncCallerDirectory(PluginCall call) {
        try {
            boolean isSuperAdmin = call.getBoolean("isSuperAdmin", false);
            SharedPreferences sp = getContext().getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            sp.edit().putBoolean("is_super_admin", isSuperAdmin).apply();

            if (!isSuperAdmin) {
                invalidateErpCallerCache();
                DurgaCallScreeningService.clearCallerDatabase(getContext());
                try { getContext().getSharedPreferences("ds_erp_directory", Context.MODE_PRIVATE).edit().clear().apply(); } catch (Throwable ignored) {}
                try { FirebaseMessaging.getInstance().unsubscribeFromTopic(DurgaMessagingService.TOPIC_SUPER_ADMIN); } catch (Throwable ignored) {}
                call.resolve();
                return;
            }
            try { FirebaseMessaging.getInstance().subscribeToTopic(DurgaMessagingService.TOPIC_SUPER_ADMIN); } catch (Throwable ignored) {}

            JSObject callers = call.getObject("callers");
            if (callers != null) {
                DurgaCallScreeningService.saveCallerDatabase(getContext(), callers.toString());
                invalidateErpCallerCache();
                getOrLoadErpCache(getContext());
            }
            call.resolve();
        } catch (Throwable t) {
            call.reject("syncCallerDirectory error: " + t.getMessage());
        }
    }

    private static synchronized java.util.Map<String, String> getOrLoadErpCache(Context ctx) {
        if (ctx == null) return null;
        try {
            java.io.File f = new java.io.File(ctx.getFilesDir(), "erp_caller_directory.json");
            if (!f.exists()) {
                f = new java.io.File(ctx.getFilesDir(), "ds_caller_db.json");
            }
            if (!f.exists()) return sErpCallerCache;
            long lm = f.lastModified();
            if (sErpCallerCache != null && lm == sErpCacheLastModified) {
                return sErpCallerCache;
            }
            byte[] bytes = new byte[(int) f.length()];
            try (java.io.FileInputStream fis = new java.io.FileInputStream(f)) {
                int read = fis.read(bytes);
                if (read <= 0) return sErpCallerCache;
            }
            org.json.JSONObject obj = new org.json.JSONObject(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            java.util.Map<String, String> map = new java.util.HashMap<>(obj.length());
            java.util.Iterator<String> keys = obj.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                String v = obj.optString(k, "");
                if (k != null && !v.trim().isEmpty()) {
                    map.put(k, v.trim());
                }
            }
            sErpCallerCache = map;
            sErpCacheLastModified = lm;
        } catch (Throwable ignored) {}
        return sErpCallerCache;
    }

    public static String lookupErpCaller(Context ctx, String p10) {
        if (ctx == null || p10 == null) return null;
        try {
            String clean10 = p10.replaceAll("\\D", "");
            if (clean10.length() < 10) return null;
            clean10 = clean10.substring(clean10.length() - 10);

            java.util.Map<String, String> cache = getOrLoadErpCache(ctx);
            if (cache != null) {
                String cachedName = cache.get(clean10);
                if (cachedName != null && !cachedName.isEmpty()) {
                    return cachedName;
                }
            }

            try {
                SharedPreferences spDir = ctx.getSharedPreferences("ds_erp_directory", Context.MODE_PRIVATE);
                String spName = spDir.getString(clean10, null);
                if (spName != null && !spName.trim().isEmpty()) {
                    return spName.trim();
                }
            } catch (Throwable ignored) {}

            String contactName = DurgaCallScreeningService.getCallerPartyName(ctx, clean10);
            if (contactName != null && !contactName.trim().isEmpty()) {
                return contactName.trim();
            }
        } catch (Throwable ignored) {}
        return null;
    }

    @PluginMethod
    public void getPopupEnabled(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            boolean enabled = sp.getBoolean("call_popup_enabled", true);
            JSObject ret = new JSObject();
            ret.put("enabled", enabled);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("getPopupEnabled error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void getCallState(PluginCall call) {
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            int mode = am != null ? am.getMode() : AudioManager.MODE_NORMAL;
            boolean isInCall = DurgaCallNotificationListener.isAnyCallActive(getContext());
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
    public void checkCallerIdRole(PluginCall call) {
        try {
            boolean held = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                RoleManager rm = (RoleManager) getContext().getSystemService(Context.ROLE_SERVICE);
                held = rm != null && rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING);
            }
            boolean notifGranted = true;
            if (Build.VERSION.SDK_INT >= 33) {
                notifGranted = getPermissionState("notifications") == PermissionState.GRANTED;
            }
            boolean notifListenerEnabled = false;
            try {
                String flat = android.provider.Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
                notifListenerEnabled = flat != null && flat.contains(getContext().getPackageName());
            } catch (Throwable ignored) {}

            JSObject ret = new JSObject();
            ret.put("held", held);
            ret.put("notificationsGranted", notifGranted);
            ret.put("notificationListenerEnabled", notifListenerEnabled);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("checkCallerIdRole error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void requestNotificationListener(PluginCall call) {
        try {
            String flat = android.provider.Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
            boolean enabled = flat != null && flat.contains(getContext().getPackageName());
            if (enabled) {
                JSObject ret = new JSObject();
                ret.put("enabled", true);
                call.resolve(ret);
                return;
            }
            Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("enabled", false);
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("requestNotificationListener error: " + t.getMessage());
        }
    }

    @PluginMethod
    public void requestCallerIdRole(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationsCallback");
                return;
            }
            launchCallScreeningRoleIntent(call);
        } catch (Throwable t) {
            call.reject("requestCallerIdRole error: " + t.getMessage());
        }
    }

    @PermissionCallback
    private void notificationsCallback(PluginCall call) {
        launchCallScreeningRoleIntent(call);
    }

    private void launchCallScreeningRoleIntent(PluginCall call) {
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
            call.reject("launchCallScreeningRoleIntent error: " + t.getMessage());
        }
    }

    @ActivityCallback
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
            String name = sp.getString("last_call_name", "");
            String dir = sp.getString("last_call_dir", "incoming");
            long timestamp = sp.getLong("last_call_time", 0);

            JSObject ret = new JSObject();
            long now = System.currentTimeMillis();
            // Return call if within last 15 minutes (match by phone or caller name)
            if (((phone != null && !phone.isEmpty()) || (name != null && !name.isEmpty())) && (now - timestamp < 15 * 60 * 1000)) {
                ret.put("phone", phone);
                ret.put("name", name != null ? name : "");
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

    private static String escapeJsString(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "");
    }

    public static void notifyLiveCall(Context context, String phone, String direction) {
        notifyLiveCall(context, phone, "", direction);
    }

    public static void notifyLiveCall(Context context, String phone, String name, String direction) {
        try {
            if (context != null) {
                SharedPreferences sp = context.getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
                sp.edit()
                    .putString("last_call_phone", phone)
                    .putString("last_call_name", name != null ? name : "")
                    .putString("last_call_dir", direction)
                    .putLong("last_call_time", System.currentTimeMillis())
                    .apply();
            }

            if (instance != null && instance.getBridge() != null && instance.getBridge().getWebView() != null) {
                instance.getBridge().getWebView().post(() -> {
                    try {
                        String safePhone = escapeJsString(phone);
                        String safeName = escapeJsString(name);
                        String safeDirection = escapeJsString(direction);
                        String js = "window.dispatchEvent(new CustomEvent('dsNativeCallDetected', { detail: { phone: '" + safePhone + "', name: '" + safeName + "', direction: '" + safeDirection + "' } }));";
                        instance.getBridge().getWebView().evaluateJavascript(js, null);
                    } catch (Throwable ignored) {}
                });
            }
        } catch (Throwable ignored) {}
    }

    public static void notifyCallDisconnected(Context context) {
        try {
            if (context != null) {
                SharedPreferences sp = context.getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
                sp.edit()
                    .remove("last_call_phone")
                    .remove("last_call_name")
                    .remove("last_call_dir")
                    .remove("last_call_time")
                    .apply();
            }

            if (instance != null && instance.getBridge() != null && instance.getBridge().getWebView() != null) {
                instance.getBridge().getWebView().post(() -> {
                    try {
                        String js = "window.dispatchEvent(new CustomEvent('dsNativeCallEnded'));";
                        instance.getBridge().getWebView().evaluateJavascript(js, null);
                    } catch (Throwable ignored) {}
                });
            }
        } catch (Throwable ignored) {}
    }

    public static boolean isMonitorEnabled() {
        return isEnabled;
    }

    public static void notifyNewUserLoggedIn(Context context, String phone, String name) {
        try {
            if (instance != null && instance.getBridge() != null && instance.getBridge().getWebView() != null) {
                instance.getBridge().getWebView().post(() -> {
                    try {
                        String safePhone = escapeJsString(phone);
                        String safeName = escapeJsString(name);
                        String js = "window.dispatchEvent(new CustomEvent('dsNewUserLoggedIn', { detail: { phone: '" + safePhone + "', name: '" + safeName + "' } }));";
                        instance.getBridge().getWebView().evaluateJavascript(js, null);
                    } catch (Throwable ignored) {}
                });
            }
        } catch (Throwable ignored) {}
    }
}
