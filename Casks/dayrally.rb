cask "dayrally" do
  version "0.1.1"
  sha256 "6a0c5cc299759d739075b979b876ff4c1f5f07981fbbd5f177a0f2f1ced1db7b"

  url "https://github.com/manojkumar-kasiviswanathan/dayrally/releases/download/v#{version}/DayRally_#{version}_aarch64.dmg"
  name "DayRally"
  desc "Workspace-based daily planner"
  homepage "https://github.com/manojkumar-kasiviswanathan/dayrally"

  depends_on arch: :arm64
  app "DayRally.app"

  zap trash: [
    "~/Library/Application Support/com.dayrally",
    "~/Library/Application Support/com.dayrally.app"
  ]
end
