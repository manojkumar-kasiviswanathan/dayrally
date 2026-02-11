cask "dayrally" do
  version "0.1.0"
  sha256 "c355586eaa36bb11ef21e58a358bc7749021561566b111e0b7dd8331059bc992"

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
