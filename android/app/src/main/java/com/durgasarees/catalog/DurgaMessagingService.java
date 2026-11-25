package com.durgasarees.catalog;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class DurgaMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "ds_new_user_channel";
    public static final String TOPIC_SUPER_ADMIN = "super_admin_alerts";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        try {
            SharedPreferences sp = getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            if (sp.getBoolean("is_super_admin", false)) {
                FirebaseMessaging.getInstance().subscribeToTopic(TOPIC_SUPER_ADMIN);
            }
        } catch (Throwable ignored) {}
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        try {
            SharedPreferences sp = getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            if (!sp.getBoolean("is_super_admin", false)) {
                return;
            }

            Map<String, String> data = remoteMessage.getData();
            String title = null;
            String body = null;
            if (remoteMessage.getNotification() != null) {
                title = remoteMessage.getNotification().getTitle();
                body = remoteMessage.getNotification().getBody();
            }
            String phone = data != null ? data.get("phone") : "";
            String name = data != null ? data.get("name") : "";
            String station = data != null ? data.get("station") : "";

            if (title == null || title.trim().isEmpty()) {
                title = (data != null && data.get("title") != null) ? data.get("title") : "New User Logged In";
            }
            if (body == null || body.trim().isEmpty()) {
                if (data != null && data.get("body") != null) {
                    body = data.get("body");
                } else {
                    String label = (name != null && !name.isEmpty()) ? name : "New Customer";
                    if (station != null && !station.isEmpty()) label += " (" + station + ")";
                    body = label + (phone != null && !phone.isEmpty() ? " • " + phone : "") + " — Tap to link & set B2B pricing";
                }
            }

            showNewUserNotification(this, title, body, phone);
            CallMonitorPlugin.notifyNewUserLoggedIn(this, phone, name);
        } catch (Throwable ignored) {}
    }

    public static void showNewUserNotification(Context context, String title, String body, String phone) {
        if (context == null) return;
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "New Customer Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Alerts Super Admin when a new user logs in so you can link party and set B2B pricing");
                channel.enableVibration(true);
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(channel);
            }

            Intent intent = new Intent(context, MainActivity.class);
            intent.setAction("OPEN_LIVE_ADMIN");
            intent.putExtra("open_live_admin", true);
            if (phone != null && !phone.isEmpty()) {
                intent.putExtra("new_user_phone", phone);
            }
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            int reqCode = (phone != null && !phone.isEmpty()) ? (2000 + Math.abs(phone.hashCode() % 1000)) : 2001;
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(context, reqCode, intent, flags);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            nm.notify(reqCode, builder.build());
        } catch (Throwable ignored) {}
    }
}
