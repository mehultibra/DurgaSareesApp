package com.durgasarees.catalog;

import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

@RequiresApi(api = Build.VERSION_CODES.N)
public class DurgaCallScreeningService extends CallScreeningService {

    @Override
    public void onScreenCall(@NonNull Call.Details callDetails) {
        try {
            // 1. Never block, silence, or delay the call - respond immediately
            CallResponse.Builder response = new CallResponse.Builder();
            respondToCall(callDetails, response.build());

            // 2. Extract caller phone number
            Uri handle = callDetails.getHandle();
            String rawNumber = (handle != null) ? handle.getSchemeSpecificPart() : "";
            if (rawNumber == null) rawNumber = "";

            String p10 = rawNumber.replaceAll("\\D", "");
            if (p10.length() >= 10) {
                p10 = p10.substring(p10.length() - 10);
            }

            // 3. Determine call direction
            String direction = "incoming";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (callDetails.getCallDirection() == Call.Details.DIRECTION_OUTGOING) {
                    direction = "outgoing";
                }
            }

            // 4. Notify CallMonitorPlugin & persist in SharedPreferences
            if (!p10.isEmpty()) {
                CallMonitorPlugin.notifyLiveCall(getApplicationContext(), p10, direction);
            }
        } catch (Throwable t) {
            try {
                respondToCall(callDetails, new CallResponse.Builder().build());
            } catch (Throwable ignored) {}
        }
    }
}

