package com.durgasarees.catalog;

import android.accounts.Account;
import android.app.Service;
import android.content.AbstractThreadedSyncAdapter;
import android.content.ContentProviderClient;
import android.content.Context;
import android.content.Intent;
import android.content.SyncResult;
import android.os.Bundle;
import android.os.IBinder;

public class DurgaSyncService extends Service {
    private static final Object sSyncAdapterLock = new Object();
    private static SyncAdapter sSyncAdapter = null;

    @Override
    public void onCreate() {
        super.onCreate();
        synchronized (sSyncAdapterLock) {
            if (sSyncAdapter == null) {
                sSyncAdapter = new SyncAdapter(getApplicationContext(), true);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return sSyncAdapter.getSyncAdapterBinder();
    }

    public static class SyncAdapter extends AbstractThreadedSyncAdapter {
        public SyncAdapter(Context context, boolean autoInitialize) {
            super(context, autoInitialize);
        }

        @Override
        public void onPerformSync(Account account, Bundle extras, String authority, ContentProviderClient provider, SyncResult syncResult) {
            try {
                if (account != null) {
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.ContactsContract.Settings.ACCOUNT_NAME, account.name);
                    cv.put(android.provider.ContactsContract.Settings.ACCOUNT_TYPE, account.type);
                    cv.put(android.provider.ContactsContract.Settings.UNGROUPED_VISIBLE, 1);
                    cv.put(android.provider.ContactsContract.Settings.SHOULD_SYNC, 1);
                    android.net.Uri settingsUri = android.provider.ContactsContract.Settings.CONTENT_URI.buildUpon()
                        .appendQueryParameter(android.provider.ContactsContract.CALLER_IS_SYNCADAPTER, "true")
                        .build();
                    int updated = getContext().getContentResolver().update(
                        settingsUri,
                        cv,
                        android.provider.ContactsContract.Settings.ACCOUNT_NAME + " = ? AND " + android.provider.ContactsContract.Settings.ACCOUNT_TYPE + " = ?",
                        new String[]{ account.name, account.type }
                    );
                    if (updated == 0) {
                        getContext().getContentResolver().insert(settingsUri, cv);
                    }
                }
            } catch (Throwable ignored) {}
        }
    }
}

