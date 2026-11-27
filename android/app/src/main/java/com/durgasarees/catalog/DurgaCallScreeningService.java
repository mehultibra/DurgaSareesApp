package com.durgasarees.catalog;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.ContactsContract;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;

public class DurgaCallScreeningService extends CallScreeningService {
    private static final String CHANNEL_ID = "ds_live_call_channel";
    private static final int NOTIFICATION_ID = 9901;

    @Override
    public void onScreenCall(@NonNull Call.Details callDetails) {
        // 1. Immediately pass call through without altering call flow
        try {
            CallResponse response = new CallResponse.Builder().build();
            respondToCall(callDetails, response);
        } catch (Throwable ignored) {
        }

        try {
            SharedPreferences sp = getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            if (!sp.getBoolean("is_super_admin", false) || !sp.getBoolean("call_popup_enabled", true)) {
                return;
            }

            Uri handle = callDetails.getHandle();
            if (handle == null)
                return;
            String rawNumber = handle.getSchemeSpecificPart();
            if (rawNumber == null || rawNumber.trim().isEmpty())
                return;

            String p10 = rawNumber.replaceAll("\\D", "");
            if (p10.length() >= 10) {
                p10 = p10.substring(p10.length() - 10);
            }
            if (p10.length() < 10)
                return;

            String direction = "incoming";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (callDetails.getCallDirection() == Call.Details.DIRECTION_OUTGOING) {
                    direction = "outgoing";
                }
            }

            // Look up party name strictly from synced ERP directory or Durga Sarees ERP Contacts account
            String erpPartyName = CallMonitorPlugin.lookupErpCaller(this, p10);

            // Hard Rule: Never save prefs, fire JS, or show notification for non-ERP numbers
            if (erpPartyName == null || erpPartyName.trim().isEmpty()) {
                return;
            }

            long now = System.currentTimeMillis();
            sp.edit()
                    .putString("last_call_phone", p10)
                    .putString("last_call_name", erpPartyName)
                    .putString("last_call_dir", direction)
                    .putLong("last_call_time", now)
                    .apply();

            // Notify running JS WebView instance
            CallMonitorPlugin.notifyLiveCall(this, p10, erpPartyName, direction);

            // Show High-Priority Heads-Up Notification
            showCallNotification(this, p10, erpPartyName, direction);
        } catch (Throwable ignored) {
        }
    }

    private static volatile JSONObject sCallerCache = null;

    public static synchronized void saveCallerDatabase(Context context, String jsonStr) {
        if (context == null || jsonStr == null) return;
        try {
            byte[] data = jsonStr.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            try (java.io.FileOutputStream fos = context.openFileOutput("erp_caller_directory.json", Context.MODE_PRIVATE)) {
                fos.write(data);
            }
            try (java.io.FileOutputStream fos2 = context.openFileOutput("ds_caller_db.json", Context.MODE_PRIVATE)) {
                fos2.write(data);
            }
            sCallerCache = new JSONObject(jsonStr);
        } catch (Throwable ignored) {}
    }

    public static synchronized void clearCallerDatabase(Context context) {
        sCallerCache = null;
        if (context == null) return;
        try {
            context.deleteFile("erp_caller_directory.json");
            context.deleteFile("ds_caller_db.json");
        } catch (Throwable ignored) {}
    }

    private static synchronized JSONObject getCallerCache(Context context) {
        if (sCallerCache != null) return sCallerCache;
        if (context == null) return null;
        try {
            java.io.File file = new java.io.File(context.getFilesDir(), "erp_caller_directory.json");
            String fname = "erp_caller_directory.json";
            if (!file.exists()) {
                file = new java.io.File(context.getFilesDir(), "ds_caller_db.json");
                fname = "ds_caller_db.json";
            }
            if (!file.exists()) return null;
            byte[] bytes = new byte[(int) file.length()];
            try (java.io.FileInputStream fis = context.openFileInput(fname)) {
                fis.read(bytes);
            }
            sCallerCache = new JSONObject(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            return sCallerCache;
        } catch (Throwable ignored) {
            return null;
        }
    }

    public static String getCallerPartyName(Context context, String p10) {
        if (p10 == null || context == null) return null;
        String clean10 = p10.replaceAll("\\D", "");
        if (clean10.length() < 10) return null;
        clean10 = clean10.substring(clean10.length() - 10);

        // 1. Direct O(1) ERP software database lookup
        JSONObject db = getCallerCache(context);
        if (db != null) {
            String name = db.optString(clean10, null);
            if (name != null && !name.trim().isEmpty()) {
                return name.trim();
            }
        }

        // 2. Fallback: Query ONLY contacts under account "com.durgasarees.catalog" (Never personal contacts)
        Cursor cursor = null;
        try {
            cursor = context.getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER },
                ContactsContract.RawContacts.ACCOUNT_TYPE + " = 'com.durgasarees.catalog' AND " + ContactsContract.RawContacts.DELETED + " = 0",
                null,
                null
            );
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    int numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                    int nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                    if (numIdx >= 0 && nameIdx >= 0) {
                        String num = cursor.getString(numIdx);
                        String name = cursor.getString(nameIdx);
                        if (num != null && name != null) {
                            String n10 = num.replaceAll("\\D", "");
                            if (n10.length() >= 10 && n10.substring(n10.length() - 10).equals(clean10)) {
                                return name.trim();
                            }
                        }
                    }
                }
            }
        } catch (Throwable ignored) {
        } finally {
            if (cursor != null) try { cursor.close(); } catch (Throwable ignored) {}
        }

        return null;
    }

    public static String getCallerPhoneByName(Context context, String name) {
        if (name == null || name.trim().isEmpty() || context == null) return null;
        String trimmed = name.trim().toUpperCase();
        JSONObject db = getCallerCache(context);
        if (db != null) {
            java.util.Iterator<String> keys = db.keys();
            while (keys.hasNext()) {
                String phone = keys.next();
                String val = db.optString(phone, "");
                if (val.toUpperCase().contains(trimmed) || trimmed.contains(val.toUpperCase())) {
                    return phone;
                }
            }
        }
        return null;
    }

    public static boolean isDurgaSareesAccount(Context context, String p10, String partyName) {
        return getCallerPartyName(context, p10) != null;
    }

    public static void showCallNotification(Context context, String p10, String partyName, String direction) {
        if (context == null)
            return;
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null)
                return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "Live Call Assistant",
                        NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Shows active caller info and Durga Sarees ERP shortcuts during calls");
                channel.enableVibration(true);
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(channel);
            }

            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction(Intent.ACTION_VIEW);
            intent.putExtra("live_call_phone", p10);
            intent.putExtra("live_call_name", partyName);
            intent.setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 101, intent, flags);

            String dirPrefix = "outgoing".equalsIgnoreCase(direction) ? "📞 Outgoing: " : "📞 Live Call: ";
            String title = dirPrefix + (partyName != null && !partyName.trim().isEmpty() ? partyName : "+91 " + p10);
            String body = "Tap to view Live Dispatches, O/S, Last Talk & Take Order";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            nm.notify(NOTIFICATION_ID, builder.build());
        } catch (Throwable ignored) {
        }
    }

    public static void dismissCallNotification(Context context) {
        if (context == null) return;
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIFICATION_ID);
            }
        } catch (Throwable ignored) {}
    }
}
