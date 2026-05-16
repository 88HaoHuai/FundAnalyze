import Foundation

let jsonString = """
jsonpgz({"fundcode":"011230","name":"创金合信数字经济主题股票C","jzrq":"2026-05-13","dwjz":"2.0057","gsz":"2.0084","gszzl":"0.13","gztime":"2026-05-14 10:02"});
"""

if let start = jsonString.range(of: "jsonpgz("),
   let end = jsonString.range(of: ");", options: .backwards) {
    let jsonStr = String(jsonString[start.upperBound..<end.lowerBound])
    print("Extracted json: \(jsonStr)")
    if let jsonData = jsonStr.data(using: .utf8) {
        do {
            if let dict = try JSONSerialization.jsonObject(with: jsonData) as? [String: String] {
                print("Dict: \(dict)")
            } else {
                print("Failed to cast to [String: String]")
                let anyDict = try JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
                print("But cast to [String: Any] works? \(anyDict != nil)")
            }
        } catch {
            print("Error: \(error)")
        }
    }
}
