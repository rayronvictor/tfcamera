import {Platform, StyleSheet} from 'react-native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useSkiaFrameProcessor,
} from "react-native-vision-camera";
import {useResizePlugin} from "vision-camera-resize-plugin";
import {matchFont, PaintStyle, Skia} from "@shopify/react-native-skia";

import {NoCameraDeviceError, PermissionRequest} from "@/components/PermissionRequest";
import {useTensorflowModel} from "react-native-fast-tflite";

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'serif' });
const font = matchFont({
  fontFamily,
  fontSize: 12,
  fontStyle: "italic",
  fontWeight: 'bold',
});

const paint = Skia.Paint()
paint.setStyle(PaintStyle.Stroke)
paint.setStrokeWidth(4);

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

export default function CameraSegmentationScreen() {
  const {hasPermission} = useCameraPermission()

  const device = useCameraDevice("back");

  const { resize } = useResizePlugin()
  const { model, state } = useTensorflowModel(require('../assets/models/yolov11_seg.tflite'))


  const frameProcessor = useSkiaFrameProcessor((frame) => {
    'worklet'
    frame.render();

    if (state !== 'loaded') {
      // model is still loading or with error...
      return
    }

    // runAsync(frame, () => {

    runAtTargetFps(1, () => {
      'worklet'

      const resized = resize(frame, {
        scale: {
          width: 640,
          height: 640,
        },
        pixelFormat: 'rgb',
        dataType: 'float32', // YOLOv11 uses float32
      })

      const [boxes, scores, masks, class_idx, protos] = model?.runSync([resized])

      const scoreIdxs = filterByConfidence(scores, 0.5)

      console.log(JSON.stringify(scoreIdxs, null, 2))

      // const maxScoreIdx = scores.reduce((maxScoreIdx: number, current: number, idx: number, arr: Float32Array<ArrayBufferLike>) => {
      //   return current > arr[maxScoreIdx] ? idx : maxScoreIdx;
      // }, 0)



      for(let i = 0; i < scoreIdxs?.length; i++) {
        // multiply the index by 4 (xc, yc, width, height => 4 values)
        const boxPos = scoreIdxs[i] * 4
        const xc = Number(boxes[boxPos])
        const yc = Number(boxes[boxPos + 1])
        const width = Number(boxes[boxPos + 2])
        const height = Number(boxes[boxPos + 3])

        console.log(`Idx: ${i}, score: ${scores[scoreIdxs[i]]}, class: ${class_idx[scoreIdxs[i]]}`)
        console.log(JSON.stringify(`Box: { xc: ${xc}, yc: ${yc}, w: ${width}, h: ${height} }`, null, 2));

        paint.setColor(Skia.Color(COLORS[i]))

        const rect = Skia.XYWHRect(xc - width / 2, yc - height / 2, width, height);
        frame.drawRect(rect, paint);
      }
    })

  }, [state, model])

  if (!hasPermission) return <PermissionRequest />
  if (device == null) return <NoCameraDeviceError />

  return (
    <Camera
      enableFpsGraph={__DEV__}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
      frameProcessor={frameProcessor}
    />
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
