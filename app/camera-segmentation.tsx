import {StyleSheet} from 'react-native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import {useResizePlugin} from "vision-camera-resize-plugin";
import {Canvas, createPicture, PaintStyle, Picture, Skia, SkSize} from "@shopify/react-native-skia";
import {useNavigation} from "expo-router";

import {NoCameraDeviceError, PermissionRequest} from "@/components/PermissionRequest";
import {useTensorflowModel} from "react-native-fast-tflite";
import {useDerivedValue, useSharedValue} from "react-native-reanimated";
import {Worklets} from "react-native-worklets-core";
import {useCameraFormat, useFrameProcessor} from "react-native-vision-camera/src";
import {useIsForeground} from "@/hooks/useIsForeground";

type Box = [number, number, number, number]

const paint = Skia.Paint()
paint.setStyle(PaintStyle.Stroke)
paint.setStrokeWidth(4);

const IMAGE_ASPECT_RATIO = 16 / 9;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

export default function CameraSegmentationScreen() {
  const navigation = useNavigation();
  const {hasPermission} = useCameraPermission()

  const device = useCameraDevice("back");
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoAspectRatio: IMAGE_ASPECT_RATIO },
  ]);

  const isActive = useIsForeground() && navigation.isFocused();

  const { resize } = useResizePlugin()
  const { model, state } = useTensorflowModel(require('../assets/models/yolov11_seg.tflite'))

  const canvasSize = useSharedValue<SkSize>({ width: 0, height: 0 });
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  const videoCanvasRatio = useSharedValue(0);

  const boxes = useSharedValue<Box[]>([]);
  const updateBoxes = Worklets.createRunOnJS((value: Box[]) => {
    boxes.value = value;
  })

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'

    if (state !== 'loaded') {
      // model is still loading or with error...
      return
    }

    console.log(`frame: ${frame.width} x ${frame.height}`);

    const IMAGE_SIZE = 640;

    const ratio = IMAGE_SIZE / frame.width;
    const width = frame.width * ratio;
    const height = frame.height * ratio;

    let offsetX = 0;
    let offsetY = 0;

    if (width > height) {
      offsetX = (width - height) / 2;
    } else {
      offsetY = (height - width) / 2;
    }

    // runAsync(frame, () => {

    runAtTargetFps(1, () => {
      'worklet'

      const resized = resize(frame, {
        scale: {
          width: IMAGE_SIZE,
          height: IMAGE_SIZE,
        },
        pixelFormat: 'rgb',
        dataType: 'float32', // YOLOv11 uses float32
        // rotation: "270deg", // TODO test if this is correct
        rotation: "90deg", // TODO test if this is correct
      })

      const [boxes, scores, masks, class_idx, protos] = model?.runSync([resized])

      const scoreIdxs = filterByConfidence(scores, 0.5)

      let newBoxes: Box[] = []

      for(let i = 0; i < scoreIdxs?.length; i++) {
        // multiply the index by 4 (xc, yc, width, height => 4 values)
        const boxPos = scoreIdxs[i] * 4
        const xc = (Number(boxes[boxPos]) + offsetX) / ratio;
        const yc = (Number(boxes[boxPos + 1]) + offsetY) / ratio;
        const width = Number(boxes[boxPos + 2]) / ratio;
        const height = Number(boxes[boxPos + 3]) / ratio;

        // console.log(`Idx: ${i}, score: ${scores[scoreIdxs[i]]}, class: ${class_idx[scoreIdxs[i]]}`)
        // console.log(JSON.stringify(`Box: { xc: ${xc}, yc: ${yc}, w: ${width}, h: ${height} }`, null, 2));

        console.log(JSON.stringify(`offsetX: ${offsetX}, offsetY: ${offsetY}, ratio: ${ratio}`, null, 2));

        newBoxes.push([xc - width / 2, yc - height / 2, width, height])
      }

      updateBoxes(newBoxes);
    })
  }, [state, model])

  useDerivedValue(() => {
    const { width, height } = canvasSize.value

    if (format) {
      videoCanvasRatio.value = width / format.videoWidth;
    }

    if (width > height) {
      offsetX.value = (width - (height * IMAGE_ASPECT_RATIO)) / 2;
      offsetY.value = 0;
    } else {
      offsetX.value = 0;
      offsetY.value = (height - (width * IMAGE_ASPECT_RATIO)) / 2;
    }
  }, [format])

  const pictures = useDerivedValue(() => {
    return createPicture((canvas) => {
      for(let i = 0; i < boxes.value.length; i++) {
        const [xc, yc, width, height] = boxes.value[i];

        paint.setColor(Skia.Color(COLORS[i % COLORS.length]))

        const rect = Skia.XYWHRect(
          xc * videoCanvasRatio.value,
          yc * videoCanvasRatio.value,
          width * videoCanvasRatio.value,
          height * videoCanvasRatio.value,
        );

        console.log(`Rect: { x: ${rect.x}, y: ${rect.y}, width: ${rect.width}, height: ${rect.height}`);

        canvas.drawRect(rect, paint);
      }
    })
  })

  if (!hasPermission) return <PermissionRequest />
  if (device == null) return <NoCameraDeviceError />

  return (
    <>
      <Camera
        device={device}
        format={format}
        isActive={isActive}
        frameProcessor={frameProcessor}
        resizeMode="contain"
        enableFpsGraph={__DEV__}
        style={StyleSheet.absoluteFill}
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

function filterByConfidence(arr: Float32Array<ArrayBufferLike>, confidence = 0.5) {
  'worklet'

  return Array.from(arr)
    .map((value, index) => {
      if (value >= confidence) {
        return index
      }
    })
    // filter undefined
    .filter((item) => item !== undefined)
}
