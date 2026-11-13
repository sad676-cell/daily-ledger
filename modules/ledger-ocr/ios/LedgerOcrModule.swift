import ExpoModulesCore
import UIKit
import Vision

/// 本地文字识别：iOS 系统 Vision 框架，离线运行，图片不出设备。
/// 返回的是「一行行文字 + 每行的像素坐标」，坐标交给 JS 侧拼行，
/// 这样调整拼行规则不需要重新编译原生代码。
public class LedgerOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LedgerOcr")

    AsyncFunction("recognizeAsync") { (uri: String, promise: Promise) in
      let url = URL(string: uri) ?? URL(fileURLWithPath: uri)

      guard
        let data = try? Data(contentsOf: url),
        let image = UIImage(data: data),
        let cgImage = image.cgImage
      else {
        promise.reject("ERR_OCR_IMAGE", "读不出这张图片：\(uri)")
        return
      }

      let width = Double(cgImage.width)
      let height = Double(cgImage.height)

      let request = VNRecognizeTextRequest { request, error in
        if let error = error {
          promise.reject("ERR_OCR_FAILED", error.localizedDescription)
          return
        }

        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        var items: [[String: Any]] = []
        items.reserveCapacity(observations.count)

        for observation in observations {
          guard let candidate = observation.topCandidates(1).first else { continue }
          let box = observation.boundingBox
          items.append([
            "text": candidate.string,
            // Vision 的坐标原点在左下角，转成左上角，和截图阅读顺序一致
            "x": Double(box.minX) * width,
            "y": (1.0 - Double(box.maxY)) * height,
            "width": Double(box.width) * width,
            "height": Double(box.height) * height,
            "confidence": Double(candidate.confidence),
          ])
        }

        guard
          let jsonData = try? JSONSerialization.data(withJSONObject: items, options: []),
          let json = String(data: jsonData, encoding: .utf8)
        else {
          promise.reject("ERR_OCR_ENCODE", "识别结果编码失败")
          return
        }

        promise.resolve(json)
      }

      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      request.recognitionLanguages = ["zh-Hans", "en-US"]

      let handler = VNImageRequestHandler(
        cgImage: cgImage,
        orientation: LedgerOcrModule.cgOrientation(image.imageOrientation),
        options: [:]
      )

      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try handler.perform([request])
        } catch {
          promise.reject("ERR_OCR_FAILED", error.localizedDescription)
        }
      }
    }
  }

  private static func cgOrientation(_ orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch orientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
