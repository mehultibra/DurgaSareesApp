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
                    android.net.Uri settingsUri = android.provider.ContactsContract.Settings.CONTENT_URI.buildUpon()
                        .appendQueryParameter(android.provider.ContactsContract.CALLER_IS_SYNCADAPTER, "true")
                        .build();
                    String sSel = android.provider.ContactsContract.Settings.ACCOUNT_NAME + " = ? AND " + android.provider.ContactsContract.Settings.ACCOUNT_TYPE + " = ?";
                    String[] sArgs = new String[]{ account.name, account.type };
                    boolean hasRow = false;
                    android.database.Cursor sc = null;
                    try {
                        sc = getContext().getContentResolver().query(settingsUri, new String[]{ android.provider.ContactsContract.Settings.UNGROUPED_VISIBLE }, sSel, sArgs, null);
                        if (sc != null && sc.moveToFirst()) hasRow = true;
                    } finally {
                        if (sc != null) try { sc.close(); } catch (Throwable ignored) {}
                    }
                    if (hasRow) {
                        android.content.ContentValues upd = new android.content.ContentValues();
                        upd.put(android.provider.ContactsContract.Settings.UNGROUPED_VISIBLE, 1);
                        upd.put(android.provider.ContactsContract.Settings.SHOULD_SYNC, 1);
                        getContext().getContentResolver().update(settingsUri, upd, sSel, sArgs);
                    } else {
                        android.content.ContentValues ins = new android.content.ContentValues();
                        ins.put(android.provider.ContactsContract.Settings.ACCOUNT_NAME, account.name);
                        ins.put(android.provider.ContactsContract.Settings.ACCOUNT_TYPE, account.type);
                        ins.put(android.provider.ContactsContract.Settings.UNGROUPED_VISIBLE, 1);
                        ins.put(android.provider.ContactsContract.Settings.SHOULD_SYNC, 1);
                        getContext().getContentResolver().insert(settingsUri, ins);
                    }
                }
            } catch (Throwable ignored) {}
        }
    }
}

