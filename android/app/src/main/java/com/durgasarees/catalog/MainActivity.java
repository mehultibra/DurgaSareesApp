package com.durgasarees.catalog;

import android.app.AlertDialog;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends BridgeActivity {
    private static final int REQ_CODE_PLAY_UPDATE = 9401;
    private static MainActivity instance;
    private boolean webCanGoBack = false;
    private boolean mUserDeferredPlayRestart = false;
    private AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateUpdatedListener;

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
            initPlayInAppUpdates();
        } catch (Throwable ignored) {}

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
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleLiveCallIntent(intent);
    }

    private void handleLiveCallIntent(android.content.Intent intent) {
        if (intent == null) return;
        boolean openLiveAdmin = intent.getBooleanExtra("open_live_admin", false) || "OPEN_LIVE_ADMIN".equals(intent.getAction());
        String newUserPhone = intent.getStringExtra("new_user_phone");
        if (openLiveAdmin) {
            intent.removeExtra("open_live_admin");
            intent.removeExtra("new_user_phone");
            setIntent(new android.content.Intent(this, MainActivity.class));
            try {
                String safeUPhone = newUserPhone != null ? newUserPhone.replace("\\", "\\\\").replace("'", "\\'") : "";
                getSharedPreferences("ds_call_prefs", MODE_PRIVATE)
                    .edit()
                    .putBoolean("pending_open_live_admin", true)
                    .putString("pending_open_live_admin_phone", newUserPhone != null ? newUserPhone : "")
                    .apply();
                if (bridge != null) {
                    bridge.triggerWindowJSEvent("dsOpenLiveAdmin", "{ phone: '" + safeUPhone + "' }");
                }
            } catch (Throwable ignored) {}
            return;
        }
        String phone = intent.getStringExtra("live_call_phone");
        String name = intent.getStringExtra("live_call_name");
        if ((phone != null && !phone.trim().isEmpty()) || (name != null && !name.trim().isEmpty())) {
            intent.removeExtra("live_call_phone");
            intent.removeExtra("live_call_name");
            setIntent(new android.content.Intent(this, MainActivity.class));
            try {
                String safePhone = phone != null ? phone.trim() : "";
                String safeName = name != null ? name.replace("\\", "\\\\").replace("'", "\\'") : "";
                getSharedPreferences("ds_call_prefs", MODE_PRIVATE)
                    .edit()
                    .putString("last_call_phone", safePhone)
                    .putString("last_call_name", name != null ? name : "")
                    .putString("last_call_dir", "incoming")
                    .putLong("last_call_time", System.currentTimeMillis())
                    .apply();
                if (bridge != null) {
                    bridge.triggerWindowJSEvent("dsNativeCallDetected", "{ phone: '" + safePhone + "', name: '" + safeName + "', direction: 'incoming' }");
                }
            } catch (Throwable ignored) {}
        }
    }

    private void initPlayInAppUpdates() {
        try {
            appUpdateManager = AppUpdateManagerFactory.create(this);
            installStateUpdatedListener = state -> {
                try {
                    if (state != null && state.installStatus() == InstallStatus.DOWNLOADED) {
                        showPlayUpdateReadyDialog();
                    }
                } catch (Throwable ignored) {}
            };
            appUpdateManager.registerListener(installStateUpdatedListener);
            checkForPlayInAppUpdate();
        } catch (Throwable ignored) {}
    }

    private void checkForPlayInAppUpdate() {
        try {
            if (appUpdateManager == null) return;
            appUpdateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
                try {
                    if (info == null) return;
                    if (info.installStatus() == InstallStatus.DOWNLOADED) {
                        if (!mUserDeferredPlayRestart) showPlayUpdateReadyDialog();
                        return;
                    }
                    if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                            && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                        long availBytes = new android.os.StatFs(getFilesDir().getPath()).getAvailableBytes();
                        if (availBytes < 80L * 1024L * 1024L) return;

                        android.content.SharedPreferences sp = getSharedPreferences("ds_call_prefs", MODE_PRIVATE);
                        long lastPrompt = sp.getLong("play_update_last_prompt_at", 0L);
                        if (System.currentTimeMillis() - lastPrompt < 7L * 24L * 60L * 60L * 1000L) return;

                        sp.edit().putLong("play_update_last_prompt_at", System.currentTimeMillis()).apply();
                        appUpdateManager.startUpdateFlowForResult(
                                info,
                                this,
                                AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
                                REQ_CODE_PLAY_UPDATE
                        );
                    }
                } catch (Throwable ignored) {}
            });
        } catch (Throwable ignored) {}
    }

    private void showPlayUpdateReadyDialog() {
        try {
            runOnUiThread(() -> {
                try {
                    if (isFinishing() || isDestroyed()) return;
                    new AlertDialog.Builder(MainActivity.this)
                            .setTitle("Update Ready")
                            .setMessage("Update downloaded — Tap Restart to install")
                            .setPositiveButton("Restart", (d, w) -> {
                                try {
                                    if (appUpdateManager != null) appUpdateManager.completeUpdate();
                                } catch (Throwable ignored) {}
                            })
                            .setNegativeButton("Later", (d, w) -> {
                                mUserDeferredPlayRestart = true;
                            })
                            .show();
                } catch (Throwable ignored) {}
            });
        } catch (Throwable ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            enforceLightNavBar();
            handleLiveCallIntent(getIntent());
            DurgaCallNotificationListener.scanActiveNotificationsNow(this);
            if (bridge != null) {
                bridge.triggerWindowJSEvent("dsNativeAppResumed");
            }
        } catch (Throwable t) {}
        try {
            if (appUpdateManager != null) {
                appUpdateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
                    try {
                        if (info != null && info.installStatus() == InstallStatus.DOWNLOADED && !mUserDeferredPlayRestart) {
                            showPlayUpdateReadyDialog();
                        }
                    } catch (Throwable ignored) {}
                });
            }
        } catch (Throwable ignored) {}
    }

    @Override
    public void onDestroy() {
        try {
            if (appUpdateManager != null && installStateUpdatedListener != null) {
                appUpdateManager.unregisterListener(installStateUpdatedListener);
                installStateUpdatedListener = null;
            }
        } catch (Throwable ignored) {}
        super.onDestroy();
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
