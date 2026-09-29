import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// Add sensitive words here. Matching ignores case for English words.
const SENSITIVE_KEYWORDS = ["敏感词示例", "马斯克", "扎克伯格"];

type SensitiveInputGuardEntry = {
	message: string;
};

function hasSensitiveKeyword(text: string): boolean {
	const normalizedText = text.toLocaleLowerCase();
	return SENSITIVE_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLocaleLowerCase()));
}

export default function (pi: ExtensionAPI) {
	pi.registerEntryRenderer<SensitiveInputGuardEntry>("sensitive-input-guard", (entry) => {
		return new Text(entry.data?.message ?? "输入涉及敏感词", 0, 0);
	});

	pi.on("input", (event) => {
		if (!hasSensitiveKeyword(event.text)) return { action: "continue" };

		pi.appendEntry("sensitive-input-guard", { message: "输入涉及敏感词" });
		return { action: "handled" };
	});
}
