//  OWLSCashApp.swift
//  Точка входа и заставка.

import SwiftUI

@main
struct OWLSCashApp: App {
    @StateObject private var store = Store()
    @State private var splashDone = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                RootView()
                    .environmentObject(store)
                if !splashDone {
                    SplashView { splashDone = true }
                        .transition(.opacity)
                        .zIndex(10)
                }
            }
            .animation(OW.base, value: splashDone)
        }
    }
}

/// Заставка: одна случайная установка про деньги, следом сова и название.
struct SplashView: View {
    let onDone: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase = 0   // 0 подпись и установка, 1 сова и название

    static let quotes = [
        "Деньги — не главное, но много не бывает",
        "Деньги — хороший слуга, но плохой хозяин",
        "Cash is king",
        "Богатый не тот, у кого много, а тот, кому хватает",
        "Копейка рубль бережёт",
        "Деньги любят тишину",
        "Скупой платит дважды",
        "Деньги к деньгам идут"
    ]
    @State private var quote = SplashView.quotes.randomElement() ?? "Cash is king"

    var body: some View {
        ZStack {
            OW.ink.ignoresSafeArea()

            if phase == 0 {
                VStack(spacing: 18) {
                    Text("Про деньги")
                        .font(OW.display(10, .regular))
                        .tracking(2)
                        .foregroundStyle(.white.opacity(0.5))
                    Text("«\(quote)»")
                        .font(OW.display(23))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .lineSpacing(6)
                        .frame(maxWidth: 300)
                }
                .padding(.horizontal, 28)
                .transition(.opacity.combined(with: .move(edge: .top)))
            } else {
                VStack(spacing: 18) {
                    Image("OwlMark")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 78, height: 78)
                        .frame(width: 116, height: 116)
                        .background(OW.bg)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.35), radius: 15, y: 10)
                    HStack(spacing: 8) {
                        Text("OWLS").foregroundStyle(.white)
                        Text("CASH").foregroundStyle(OW.accent)
                    }
                    .font(OW.display(26))
                    .tracking(1.6)
                }
                .transition(.opacity.combined(with: .scale(scale: 0.85)))
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { onDone() }
        .onAppear(perform: run)
    }

    private func run() {
        if reduceMotion {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { onDone() }
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.9) {
            withAnimation(OW.base) { phase = 1 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { onDone() }
    }
}
