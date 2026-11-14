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

            SharedPreferences sp = getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            if (!sp.getBoolean("call_popup_enabled", true)) {
                return;
            }

            // Look up contact name if present in phone contacts
            String partyName = lookupContactName(p10);

            // Strict check: Only show notification/popup for numbers matching accounts in our app
            if (!isDurgaSareesAccount(this, p10, partyName)) {
                return;
            }

            long now = System.currentTimeMillis();
            sp.edit()
                    .putString("last_call_phone", p10)
                    .putString("last_call_name", partyName != null ? partyName : "")
                    .putString("last_call_dir", direction)
                    .putLong("last_call_time", now)
                    .apply();

            // Notify running JS WebView instance
            CallMonitorPlugin.notifyLiveCall(this, p10, partyName, direction);

            // Show High-Priority Heads-Up Notification
            showCallNotification(this, p10, partyName, direction);
        } catch (Throwable ignored) {
        }
    }

    public static boolean isDurgaSareesAccount(Context context, String p10, String partyName) {
        if (partyName != null && !partyName.trim().isEmpty()) {
            String pUpper = partyName.toUpperCase();
            boolean isNoise = pUpper.contains("RECORD") || pUpper.contains("SAVING") || pUpper.contains("SAVED") ||
                pUpper.contains("AUDIO") || pUpper.contains("VOICE") || pUpper.contains("PLAYER") ||
                pUpper.contains("[SIM") || pUpper.contains("[JIO") || pUpper.contains("[AIRTEL") ||
                pUpper.contains("[UNKNOWN") || pUpper.contains(".M4A") || pUpper.contains(".MP3") || pUpper.contains(".AMR");
            if (!isNoise) {
                if ((pUpper.contains("[") && pUpper.contains("]")) || pUpper.contains("(AG:")) {
                    return true;
                }
            }
        }
        if (p10 == null || p10.length() < 10 || context == null) return false;
        String clean10 = p10.replaceAll("\\D", "");
        if (clean10.length() >= 10) clean10 = clean10.substring(clean10.length() - 10);

        Cursor cursor = null;
        try {
            Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(clean10));
            cursor = context.getContentResolver().query(uri, new String[]{ ContactsContract.PhoneLookup.DISPLAY_NAME }, null, null, null);
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    int nameIdx = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME);
                    if (nameIdx >= 0) {
                        String name = cursor.getString(nameIdx);
                        if (name != null) {
                            String nUpper = name.toUpperCase();
                            if ((nUpper.contains("[") && nUpper.contains("]")) || nUpper.contains("(AG:")) {
                                return true;
                            }
                        }
                    }
                }
            }
        } catch (Throwable ignored) {
        } finally {
            if (cursor != null) try { cursor.close(); } catch (Throwable ignored) {}
        }
        return false;
    }

    private String lookupContactName(String p10) {
        Cursor cursor = null;
        try {
            Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(p10));
            cursor = getContentResolver().query(uri, new String[] { ContactsContract.PhoneLookup.DISPLAY_NAME }, null,
                    null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int nameIdx = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME);
                if (nameIdx >= 0)
                    return cursor.getString(nameIdx);
            }
        } catch (Throwable ignored) {
        } finally {
            if (cursor != null) {
                try {
                    cursor.close();
                } catch (Throwable ignored) {
                }
            }
        }
        return null;
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
