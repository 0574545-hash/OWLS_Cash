//  Design.swift
//  Стандарты OWLS: цвета, шрифты, отступы, движение.
//  Значения те же, что в css/owls.css веб-версии.

import SwiftUI
import UIKit

enum OW {

    // MARK: - Цвет

    /// Тёплая бумага, фон экрана.
    static let bg = Color(hex: 0xF0E9DC)
    /// Подложка вокруг телефона на широком экране.
    static let ground = Color(hex: 0xE4DAC6)
    static let card = Color.white
    /// Граница карточки, шапки, меню.
    static let line = Color(hex: 0xE0D7C4)
    /// Разделитель строк внутри карточки.
    static let lineSoft = Color(hex: 0xEBE3D5)
    /// Подложка полей, дуга-подложка на дашборде.
    static let stone = Color(hex: 0xE5DCC9)
    /// Шевроны, плейсхолдер, пунктир.
    static let sand = Color(hex: 0xC4B79E)

    static let ink = Color(hex: 0x0B1E35)
    static let ink2 = Color(hex: 0x2A3A52)
    static let muted = Color(hex: 0x6B6152)
    static let faint = Color(hex: 0x9A8F7C)

    /// Единственный акцент: действие и прогресс, не больше пятой части экрана.
    static let accent = Color(hex: 0xF26336)
    static let accentSoft = Color(hex: 0xFEEFEA)
    static let accentDark = Color(hex: 0xD94B1F)

    /// Палитра дуг на дашборде, по убыванию суммы категории.
    static let ramp: [Color] = [
        Color(hex: 0x0B1E35), Color(hex: 0xF26336), Color(hex: 0x16304E), Color(hex: 0x6B6152),
        Color(hex: 0xC4B79E), Color(hex: 0x2A3A52), Color(hex: 0xFBD5C7), Color(hex: 0x9A8F7C)
    ]

    // MARK: - Шрифты
    // Unbounded только заголовки, числа и надзаголовки. Manrope всё остальное.

    static func display(_ size: CGFloat, _ weight: DisplayWeight = .extraBold) -> Font {
        .custom(weight.name, fixedSize: size)
    }
    static func body(_ size: CGFloat, _ weight: BodyWeight = .medium) -> Font {
        .custom(weight.name, fixedSize: size)
    }

    enum DisplayWeight {
        case regular, extraBold
        var name: String { self == .regular ? "Unbounded-Regular" : "Unbounded-ExtraBold" }
    }
    enum BodyWeight {
        case medium, semiBold, bold
        /// Имена PostScript, а не имена файлов: Google отдаёт статические
        /// начертания Manrope с семейством «ManropeExtraLight».
        var name: String {
            switch self {
            case .medium: return "ManropeExtraLight-Medium"
            case .semiBold: return "ManropeExtraLight-SemiBold"
            case .bold: return "ManropeExtraLight-Bold"
            }
        }
    }

    // MARK: - Радиусы

    static let rCard: CGFloat = 14
    static let rBig: CGFloat = 12
    static let rKey: CGFloat = 11
    static let rBtn: CGFloat = 10
    static let rTile: CGFloat = 9
    static let rChip: CGFloat = 8

    // MARK: - Движение
    // 120 мс на смену состояния, 200 мс на появление, 260 мс на переход экрана.

    static let press = Animation.easeOut(duration: 0.12)
    static let base = Animation.easeOut(duration: 0.2)
    static let screen = Animation.easeOut(duration: 0.26)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

// MARK: - Общие кусочки интерфейса

/// Карточка: белая, тонкая граница, без тени в покое.
struct CardBackground: ViewModifier {
    var padding: EdgeInsets = EdgeInsets(top: 16, leading: 18, bottom: 16, trailing: 18)
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(OW.card)
            .clipShape(RoundedRectangle(cornerRadius: OW.rCard, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: OW.rCard, style: .continuous)
                    .stroke(OW.line, lineWidth: 1)
            )
    }
}

extension View {
    func owlsCard(_ padding: EdgeInsets = EdgeInsets(top: 16, leading: 18, bottom: 16, trailing: 18)) -> some View {
        modifier(CardBackground(padding: padding))
    }
}

/// Отклик на нажатие: быстрое сжатие, мягкий возврат.
struct PressStyle: ButtonStyle {
    var scale: CGFloat = 0.92
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(configuration.isPressed ? .easeOut(duration: 0.06) : OW.press,
                       value: configuration.isPressed)
    }
}

/// Знак совы лежит обычным файлом в бандле: сборщик каталогов ресурсов
/// на этой машине зависает, поэтому каталог из проекта временно убран.
struct OwlMark: View {
    var size: CGFloat
    var body: some View {
        if let path = Bundle.main.path(forResource: "owl", ofType: "png"),
           let img = UIImage(contentsOfFile: path) {
            Image(uiImage: img).resizable().scaledToFit().frame(width: size, height: size)
        } else {
            Color.clear.frame(width: size, height: size)
        }
    }
}

/// Надзаголовок: Manrope, капитель, разрядка.
struct Label10: View {
    let text: String
    var tracking: CGFloat = 0.09
    var body: some View {
        Text(text.uppercased())
            .font(OW.body(10.5, .semiBold))
            .tracking(tracking * 10.5)
            .foregroundStyle(OW.muted)
    }
}
