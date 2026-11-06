package com.durgasarees.catalog;

import android.app.Activity;
import android.content.Intent;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

@CapacitorPlugin(name = "NativeSpeech")
public class NativeSpeechPlugin extends Plugin {

    @PluginMethod
    public void startListening(PluginCall call) {
        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            String lang = call.getString("lang", "hi-IN");
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak CRM Call Note...");

            startActivityForResult(call, intent, "speechResultCallback");
        } catch (Throwable t) {
            call.reject("Speech recognition not available: " + t.getMessage());
        }
    }

    @ActivityCallback
    private void speechResultCallback(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                ArrayList<String> matches = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (matches != null && !matches.isEmpty()) {
                    JSObject ret = new JSObject();
                    ret.put("text", matches.get(0));
                    call.resolve(ret);
                    return;
                }
            }
            call.reject("No speech recognized");
        } catch (Throwable t) {
            call.reject("Speech result error: " + t.getMessage());
        }
    }
}
