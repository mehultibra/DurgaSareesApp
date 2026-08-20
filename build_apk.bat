@echo off
echo ========================================================
echo Configuring Java and bypassing ALL corrupted Gradle caches...
echo ========================================================

:: Set Java Home to Android Studio's bundled JDK
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%

:: Set a temporary, fresh global Gradle home
set GRADLE_USER_HOME=C:\Users\DELLNEW\.gradle_fresh

cd android
echo Starting build with a brand new project cache... Please wait.
call gradlew bundleRelease --no-daemon --info --project-cache-dir=../.gradle_project_fresh

echo.
echo ========================================================
echo If the build was successful, your Android App Bundle is at:
echo android\app\build\outputs\bundle\release\
echo ========================================================
