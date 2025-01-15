import {Alert, Platform, StyleSheet, Text, View} from 'react-native';
import {
  Camera,
  runAsync,
  useCameraDevice,
  useCameraPermission,
  useSkiaFrameProcessor,
} from "react-native-vision-camera";
import {useEffect} from "react";
// import {useResizePlugin} from "vision-camera-resize-plugin";
import {useImageLabeler} from "react-native-vision-camera-v3-image-labeling";
import {Canvas, createPicture, matchFont, PaintStyle, Picture, Skia, SkSize,} from "@shopify/react-native-skia";
import {Worklets} from "react-native-worklets-core";
import {Label} from "react-native-vision-camera-v3-image-labeling/src/types";
import {useDerivedValue, useSharedValue} from "react-native-reanimated";


const fontFamily = Platform.select({ ios: 'Helvetica', default: 'serif' });
const font = matchFont({
  fontFamily,
  // fontFamily: 'serif',
  fontSize: 12,
  fontStyle: "italic",
  fontWeight: 'bold',
});

export default function CameraScreen() {
  const {hasPermission} = useCameraPermission()

  const device = useCameraDevice('back')

  // const { resize } = useResizePlugin()
  const { scanImage } = useImageLabeler({ minConfidence: 0.1 })

  const canvasSize = useSharedValue<SkSize>({ width: 0, height: 0 });
  const labels = useSharedValue<Label | null>(null);
  const updateLabelValue = Worklets.createRunOnJS((value: Label) => {
    labels.value = value;
  })

  const frameProcessor = useSkiaFrameProcessor((frame) => {
    'worklet'
    frame.render();

    // const resized = resize(frame, {
    //   scale: {
    //     width: 192,
    //     height: 192
    //   },
    //   pixelFormat: 'rgb',
    //   dataType: 'uint8'
    // })

    runAsync(frame, () => {
      'worklet'
      updateLabelValue(scanImage(frame))
    })

  }, [])

  const pictures = useDerivedValue(() => {
    return createPicture((canvas) => {
      if(labels.value !== null  && Object.keys(labels).length > 0) {

        const label = labels.value[0];

        if (label.confidence > 0.75) {
          // console.log(`You're looking at a ${label.label} with confidence of ${label.confidence.toPrecision(2)}.`)

          const text = `${label.label} ${label.confidence.toPrecision(2)}`;

          const paint = Skia.Paint()

          const textRect = font.measureText(text, paint)
          const centerX = (canvasSize.value.width / 2) - (textRect.width / 2)
          const centerY = canvasSize.value.height * 0.1

          // Draw text background
          paint.setColor(Skia.Color('black'))
          const rect = Skia.XYWHRect(centerX - 5, centerY - 15, textRect.width + 10, 20);
          canvas.drawRect(rect, paint);

          // Draw text
          paint.setColor(Skia.Color('white'))
          canvas.drawText(`${label.label} ${label.confidence.toPrecision(2)}`, centerX, centerY, paint, font)
        }
      }
    })
  })

  if (!hasPermission) return <PermissionsPage/>
  if (device == null) return <NoCameraDeviceError/>

  return (
    <>
      <Camera
        enableFpsGraph={__DEV__}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
      />

      <Canvas
        style={StyleSheet.absoluteFill}
        onSize={canvasSize}
      >
        <Picture picture={pictures} />
      </Canvas>
    </>
  );
}

function PermissionsPage() {
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

function NoCameraDeviceError() {
  return (
    <View>
      <Text>No camera access!</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
