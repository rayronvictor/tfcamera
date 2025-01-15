import { useCameraPermission } from "react-native-vision-camera";
import { useEffect } from "react";
import { Alert, Text, View } from "react-native";


export function PermissionRequest() {
  const { hasPermission, requestPermission } = useCameraPermission();
  useEffect(() => {
    const p = async () => {
      let granted = true;
      if (!hasPermission) {
        granted = await requestPermission();
      }

      if (!hasPermission && !granted) {
        Alert.alert(
          "Permission needed!",
          `We need permission access to the camera to take and save photos!`,
          [
            {
              text: "Go to configurations",
              isPreferred: true,
              // TODO usar import * as Linking from 'expo-linking';
              // onPress: () => Linking.openSettings(),
              onPress: () => {},
            },
          ],
          { cancelable: true },
        );
      }
    };

    p();
  }, [hasPermission, requestPermission]);

  return (
    <View>
      <Text>You need to give camera access permission</Text>
    </View>
  )
}

export function NoCameraDeviceError() {
  return (
    <View>
      <Text>No camera access!</Text>
    </View>
  )
}
