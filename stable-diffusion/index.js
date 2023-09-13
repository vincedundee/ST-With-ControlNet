// @ts-nocheck
import {
    saveSettingsDebounced,
    systemUserName,
    hideSwipeButtons,
    showSwipeButtons,
    callPopup,
    getRequestHeaders,
    event_types,
    eventSource,
    appendImageToMessage,
    generateQuietPrompt,
    this_chid,
    getCurrentChatId,
} from "../../../script.js";
import {
    getApiUrl,
    getContext,
    extension_settings,
    doExtrasFetch,
    modules,
    renderExtensionTemplate,
} from "../../extensions.js";
import { selected_group } from "../../group-chats.js";
import {
    stringFormat,
    initScrollHeight,
    resetScrollHeight,
    getCharaFilename,
    saveBase64AsFile,
} from "../../utils.js";
import {
    getMessageTimeStamp,
    humanizedDateTime,
} from "../../RossAscends-mods.js";
import { SECRET_KEYS, secret_state } from "../../secrets.js";
import {
    getNovelUnlimitedImageGeneration,
    getNovelAnlas,
    loadNovelSubscriptionData,
} from "../../nai-settings.js";
export { MODULE_NAME };

// Wraps a string into monospace font-face span
const m = (x) => `<span class="monospace">${x}</span>`;
// Joins an array of strings with ' / '
const j = (a) => a.join(" / ");
// Wraps a string into paragraph block
const p = (a) => `<p>${a}</p>`;

const MODULE_NAME = "sd";
const UPDATE_INTERVAL = 1000;

const sources = {
    extras: "extras",
    horde: "horde",
    auto: "auto",
    novel: "novel",
};

const generationMode = {
    CHARACTER: 0,
    USER: 1,
    SCENARIO: 2,
    RAW_LAST: 3,
    NOW: 4,
    FACE: 5,
    FREE: 6,
    BACKGROUND: 7,
};

const modeLabels = {
    [generationMode.CHARACTER]: 'Character ("Yourself")',
    [generationMode.FACE]: 'Portrait ("Your Face")',
    [generationMode.USER]: 'User ("Me")',
    [generationMode.SCENARIO]: 'Scenario ("The Whole Story")',
    [generationMode.NOW]: "Last Message",
    [generationMode.RAW_LAST]: "Raw Last Message",
    [generationMode.BACKGROUND]: "Background",
};

const triggerWords = {
    [generationMode.CHARACTER]: ["you"],
    [generationMode.USER]: ["me"],
    [generationMode.SCENARIO]: ["scene"],
    [generationMode.RAW_LAST]: ["raw_last"],
    [generationMode.NOW]: ["last"],
    [generationMode.FACE]: ["face"],
    [generationMode.BACKGROUND]: ["background"],
};

const promptTemplates = {
    /*OLD:     [generationMode.CHARACTER]: "Pause your roleplay and provide comma-delimited list of phrases and keywords which describe {{char}}'s physical appearance and clothing. Ignore {{char}}'s personality traits, and chat history when crafting this description. End your response once the comma-delimited list is complete. Do not roleplay when writing this description, and do not attempt to continue the story.", */
    [generationMode.CHARACTER]:
        "[In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'full body portrait,']",
    //face-specific prompt
    [generationMode.FACE]:
        "[In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, facial features and expressions, occupation, hair and hair accessories (if any), what they are wearing on their upper body (if anything). Do not describe anything below their neck. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'close up facial portrait,']",
    //prompt for only the last message
    [generationMode.USER]:
        "[Pause your roleplay and provide a detailed description of {{user}}'s physical appearance from the perspective of {{char}} in the form of a comma-delimited list of keywords and phrases. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'full body portrait,'. Ignore the rest of the story when crafting this description. Do not roleplay as {{char}} when writing this description, and do not attempt to continue the story.]",
    [generationMode.SCENARIO]:
        "[Pause your roleplay and provide a detailed description for all of the following: a brief recap of recent events in the story, {{char}}'s appearance, and {{char}}'s surroundings. Do not roleplay while writing this description.]",

    [generationMode.NOW]: `[Pause your roleplay. Your next response must be formatted as a single comma-delimited list of concise keywords.  The list will describe of the visual details included in the last chat message.

    Only mention characters by using pronouns ('he','his','she','her','it','its') or neutral nouns ('male', 'the man', 'female', 'the woman').

    Ignore non-visible things such as feelings, personality traits, thoughts, and spoken dialog.

    Add keywords in this precise order:
    a keyword to describe the location of the scene,
    a keyword to mention how many characters of each gender or type are present in the scene (minimum of two characters:
    {{user}} and {{char}}, example: '2 men ' or '1 man 1 woman ', '1 man 3 robots'),

    keywords to describe the relative physical positioning of the characters to each other (if a commonly known term for the positioning is known use it instead of describing the positioning in detail) + 'POV',

    a single keyword or phrase to describe the primary act taking place in the last chat message,

    keywords to describe {{char}}'s physical appearance and facial expression,
    keywords to describe {{char}}'s actions,
    keywords to describe {{user}}'s physical appearance and actions.

    If character actions involve direct physical interaction with another character, mention specifically which body parts interacting and how.

    A correctly formatted example response would be:
    '(location),(character list by gender),(primary action), (relative character position) POV, (character 1's description and actions), (character 2's description and actions)']`,

    [generationMode.RAW_LAST]:
        "[Pause your roleplay and provide ONLY the last chat message string back to me verbatim. Do not write anything after the string. Do not roleplay at all in your response. Do not continue the roleplay story.]",
    [generationMode.BACKGROUND]:
        "[Pause your roleplay and provide a detailed description of {{char}}'s surroundings in the form of a comma-delimited list of keywords and phrases. The list must include all of the following items in this order: location, time of day, weather, lighting, and any other relevant details. Do not include descriptions of characters and non-visual qualities such as names, personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'background,'. Ignore the rest of the story when crafting this description. Do not roleplay as {{user}} when writing this description, and do not attempt to continue the story.]",
};

const helpString = [
    `${m("(argument)")} – requests SD to make an image. Supported arguments:`,
    "<ul>",
    `<li>${m(
        j(triggerWords[generationMode.CHARACTER])
    )} – AI character full body selfie</li>`,
    `<li>${m(
        j(triggerWords[generationMode.FACE])
    )} – AI character face-only selfie</li>`,
    `<li>${m(
        j(triggerWords[generationMode.USER])
    )} – user character full body selfie</li>`,
    `<li>${m(
        j(triggerWords[generationMode.SCENARIO])
    )} – visual recap of the whole chat scenario</li>`,
    `<li>${m(
        j(triggerWords[generationMode.NOW])
    )} – visual recap of the last chat message</li>`,
    `<li>${m(
        j(triggerWords[generationMode.RAW_LAST])
    )} – visual recap of the last chat message with no summary</li>`,
    `<li>${m(
        j(triggerWords[generationMode.BACKGROUND])
    )} – generate a background for this chat based on the chat's context</li>`,
    "</ul>",
    `Anything else would trigger a "free mode" to make SD generate whatever you prompted.<Br>
    example: '/sd apple tree' would generate a picture of an apple tree.`,
].join("<br>");
//prompt type storage for ControlNet
let rememberThePromptTypeForControlNetPleasePalThanks = null;
//----------------------------------
const defaultSettings = {
    source: sources.extras,
    //ControlNet
    controlnet: false,
    controlnet_pixelperfect: true,
    controlnet_weight: 1,
    controlnet_inputRef: "char",
    controlnet_attachTo: [6, 4, 1, 3],
    // CFG Scale
    scale_min: 1,
    scale_max: 30,
    scale_step: 0.5,
    scale: 7,

    // Sampler steps
    steps_min: 1,
    steps_max: 150,
    steps_step: 1,
    steps: 20,

    // Image dimensions (Width & Height)
    dimension_min: 64,
    dimension_max: 2048,
    dimension_step: 64,
    width: 512,
    height: 512,

    prompt_prefix: "best quality, masterpiece,",
    negative_prompt:
        "lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
    sampler: "DDIM",
    model: "",

    // Automatic1111/Horde exclusives
    restore_faces: false,
    enable_hr: false,

    // Horde settings
    horde: false,
    horde_nsfw: false,
    horde_karras: true,

    // Refine mode
    refine_mode: false,
    prompts: promptTemplates,

    // AUTOMATIC1111 settings
    auto_url: "http://localhost:7860",
    auto_auth: "",

    hr_upscaler: "Latent",
    hr_scale: 2.0,
    hr_scale_min: 1.0,
    hr_scale_max: 4.0,
    hr_scale_step: 0.1,
    denoising_strength: 0.7,
    denoising_strength_min: 0.0,
    denoising_strength_max: 1.0,
    denoising_strength_step: 0.01,
    hr_second_pass_steps: 0,
    hr_second_pass_steps_min: 0,
    hr_second_pass_steps_max: 150,
    hr_second_pass_steps_step: 1,

    // NovelAI settings
    novel_upscale_ratio_min: 1.0,
    novel_upscale_ratio_max: 4.0,
    novel_upscale_ratio_step: 0.1,
    novel_upscale_ratio: 1.0,
    novel_anlas_guard: false,
};

const getAutoRequestBody = () => ({
    url: extension_settings.sd.auto_url,
    auth: extension_settings.sd.auto_auth,
});

function toggleSourceControls() {
    $(".sd_settings [data-sd-source]").each(function () {
        const source = $(this).data("sd-source");
        $(this).toggle(source === extension_settings.sd.source);
    });
    //ControlNet -------------------
    if (extension_settings.sd.source !== "auto") {
        $("#sd_controlnet_mode").prop("checked", false);
        onControlNetInput(); //run input to turn off controlnet if not automatic1111.
    }
    //-------------------------------
}

async function loadSettings() {
    // Initialize settings
    if (Object.keys(extension_settings.sd).length === 0) {
        Object.assign(extension_settings.sd, defaultSettings);
    }

    // Insert missing settings
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (extension_settings.sd[key] === undefined) {
            extension_settings.sd[key] = value;
        }
    }

    if (extension_settings.sd.prompts === undefined) {
        extension_settings.sd.prompts = promptTemplates;
    }

    // Insert missing templates
    for (const [key, value] of Object.entries(promptTemplates)) {
        if (extension_settings.sd.prompts[key] === undefined) {
            extension_settings.sd.prompts[key] = value;
        }
    }

    if (extension_settings.sd.character_prompts === undefined) {
        extension_settings.sd.character_prompts = {};
    }
    //ControlNet. added - vincedundee
    $("#sd_controlnet_mode").prop("checked", extension_settings.sd.controlnet);
    $("#sd_controlnet_pixelperfect").prop(
        "checked",
        extension_settings.sd.controlnet_pixelperfect
    );
    $("#sd_controlnet_weight")
        .val(extension_settings.sd.controlnet_weight)
        .trigger("input");
    $("#sd_controlnet_prefer").val(extension_settings.sd.controlnet_prefer);
    $("#sd_controlnet_inputRef").val(extension_settings.sd.controlnet_inputRef);
    console.log("attachedTo", extension_settings.sd.controlnet_attachTo);
    $("input[name='sd_controlnet_attachTo']").prop("checked", function () {
        return extension_settings.sd.controlnet_attachTo.includes(
            $(this).val()
        );
    });
    //----------
    $("#sd_source").val(extension_settings.sd.source);
    $("#sd_scale").val(extension_settings.sd.scale).trigger("input");
    $("#sd_steps").val(extension_settings.sd.steps).trigger("input");
    $("#sd_prompt_prefix")
        .val(extension_settings.sd.prompt_prefix)
        .trigger("input");
    $("#sd_negative_prompt")
        .val(extension_settings.sd.negative_prompt)
        .trigger("input");
    $("#sd_width").val(extension_settings.sd.width).trigger("input");
    $("#sd_height").val(extension_settings.sd.height).trigger("input");
    $("#sd_hr_scale").val(extension_settings.sd.hr_scale).trigger("input");
    $("#sd_denoising_strength")
        .val(extension_settings.sd.denoising_strength)
        .trigger("input");
    $("#sd_hr_second_pass_steps")
        .val(extension_settings.sd.hr_second_pass_steps)
        .trigger("input");
    $("#sd_novel_upscale_ratio")
        .val(extension_settings.sd.novel_upscale_ratio)
        .trigger("input");
    $("#sd_novel_anlas_guard").prop(
        "checked",
        extension_settings.sd.novel_anlas_guard
    );
    $("#sd_horde").prop("checked", extension_settings.sd.horde);
    $("#sd_horde_nsfw").prop("checked", extension_settings.sd.horde_nsfw);
    $("#sd_horde_karras").prop("checked", extension_settings.sd.horde_karras);
    $("#sd_restore_faces").prop("checked", extension_settings.sd.restore_faces);
    $("#sd_enable_hr").prop("checked", extension_settings.sd.enable_hr);
    $("#sd_refine_mode").prop("checked", extension_settings.sd.refine_mode);
    $("#sd_auto_url").val(extension_settings.sd.auto_url);
    $("#sd_auto_auth").val(extension_settings.sd.auto_auth);

    toggleSourceControls();
    addPromptTemplates();

    await Promise.all([loadSamplers(), loadModels()]);
}

function addPromptTemplates() {
    $("#sd_prompt_templates").empty();

    for (const [name, prompt] of Object.entries(
        extension_settings.sd.prompts
    )) {
        const label = $("<label></label>")
            .text(modeLabels[name])
            .attr("for", `sd_prompt_${name}`);
        const textarea = $("<textarea></textarea>")
            .addClass("textarea_compact text_pole")
            .attr("id", `sd_prompt_${name}`)
            .attr("rows", 6)
            .val(prompt)
            .on("input", () => {
                extension_settings.sd.prompts[name] = textarea.val();
                saveSettingsDebounced();
            });
        const button = $("<button></button>")
            .addClass("menu_button fa-solid fa-undo")
            .attr("title", "Restore default")
            .on("click", () => {
                textarea.val(promptTemplates[name]);
                extension_settings.sd.prompts[name] = promptTemplates[name];
                saveSettingsDebounced();
            });
        const container = $("<div></div>")
            .addClass("title_restorable")
            .append(label)
            .append(button);
        $("#sd_prompt_templates").append(container);
        $("#sd_prompt_templates").append(textarea);
    }
}

async function refinePrompt(prompt) {
    if (extension_settings.sd.refine_mode) {
        const refinedPrompt = await callPopup(
            '<h3>Review and edit the prompt:</h3>Press "Cancel" to abort the image generation.',
            "input",
            prompt,
            { rows: 5, okButton: "Generate" }
        );

        if (refinedPrompt) {
            return refinedPrompt;
        } else {
            throw new Error("Generation aborted by user.");
        }
    }

    return prompt;
}

function onChatChanged() {
    if (this_chid === undefined || selected_group) {
        $("#sd_character_prompt_block").hide();
        return;
    }

    $("#sd_character_prompt_block").show();
    const key = getCharaFilename(this_chid);
    $("#sd_character_prompt").val(
        key ? extension_settings.sd.character_prompts[key] || "" : ""
    );
}

function onCharacterPromptInput() {
    const key = getCharaFilename(this_chid);
    extension_settings.sd.character_prompts[key] = $(
        "#sd_character_prompt"
    ).val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function getCharacterPrefix() {
    if (selected_group) {
        return "";
    }

    const key = getCharaFilename(this_chid);

    if (key) {
        return extension_settings.sd.character_prompts[key] || "";
    }

    return "";
}

function combinePrefixes(str1, str2) {
    if (!str2) {
        return str1;
    }

    // Remove leading/trailing white spaces and commas from the strings
    str1 = str1.trim().replace(/^,|,$/g, "");
    str2 = str2.trim().replace(/^,|,$/g, "");

    // Combine the strings with a comma between them
    var result = `${str1}, ${str2},`;

    return result;
}

function onRefineModeInput() {
    extension_settings.sd.refine_mode = !!$("#sd_refine_mode").prop("checked");
    saveSettingsDebounced();
}

function onScaleInput() {
    extension_settings.sd.scale = Number($("#sd_scale").val());
    $("#sd_scale_value").text(extension_settings.sd.scale.toFixed(1));
    saveSettingsDebounced();
}

function onStepsInput() {
    extension_settings.sd.steps = Number($("#sd_steps").val());
    $("#sd_steps_value").text(extension_settings.sd.steps);
    saveSettingsDebounced();
}

function onPromptPrefixInput() {
    extension_settings.sd.prompt_prefix = $("#sd_prompt_prefix").val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function onNegativePromptInput() {
    extension_settings.sd.negative_prompt = $("#sd_negative_prompt").val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function onSamplerChange() {
    extension_settings.sd.sampler = $("#sd_sampler").find(":selected").val();
    saveSettingsDebounced();
}

function onWidthInput() {
    extension_settings.sd.width = Number($("#sd_width").val());
    $("#sd_width_value").text(extension_settings.sd.width);
    saveSettingsDebounced();
}

function onHeightInput() {
    extension_settings.sd.height = Number($("#sd_height").val());
    $("#sd_height_value").text(extension_settings.sd.height);
    saveSettingsDebounced();
}

async function onSourceChange() {
    extension_settings.sd.source = $("#sd_source").find(":selected").val();
    extension_settings.sd.model = null;
    extension_settings.sd.sampler = null;
    toggleSourceControls();
    saveSettingsDebounced();
    await Promise.all([loadModels(), loadSamplers()]);
}

async function onViewAnlasClick() {
    const result = await loadNovelSubscriptionData();

    if (!result) {
        toastr.warning(
            "Are you subscribed?",
            "Could not load NovelAI subscription data"
        );
        return;
    }

    const anlas = getNovelAnlas();
    const unlimitedGeneration = getNovelUnlimitedImageGeneration();

    toastr.info(
        `Free image generation: ${unlimitedGeneration ? "Yes" : "No"}`,
        `Anlas: ${anlas}`
    );
}

function onNovelUpscaleRatioInput() {
    extension_settings.sd.novel_upscale_ratio = Number(
        $("#sd_novel_upscale_ratio").val()
    );
    $("#sd_novel_upscale_ratio_value").text(
        extension_settings.sd.novel_upscale_ratio.toFixed(1)
    );
    saveSettingsDebounced();
}

function onNovelAnlasGuardInput() {
    extension_settings.sd.novel_anlas_guard = !!$("#sd_novel_anlas_guard").prop(
        "checked"
    );
    saveSettingsDebounced();
}
//------------------ControlNet------------------
async function onControlNetInput() {
    //Don't allow other sources to use controlnet
    if (
        !!$("#sd_controlnet_mode").prop("checked") &&
        extension_settings.sd.source !== "auto"
    ) {
        toastr.error("ControlNet is only available for Automatic1111.");
        $("#sd_controlnet_mode").prop("checked", false);
        return;
    }
    //-------------------------------------------
    extension_settings.sd.controlnet = !!$("#sd_controlnet_mode").prop(
        "checked"
    );
    const optionsDiv = document.getElementById("controlnet_options");
    if (extension_settings.sd.controlnet) {
        toastr.info(
            "ControlNet mode enabled. This will take longer to generate images."
        );
        optionsDiv.style.display = "block";
    } else {
        optionsDiv.style.display = "none";
    }

    saveSettingsDebounced();
}
async function onControlNetPreferInput() {
    extension_settings.sd.controlnet_prefer = $("#sd_controlnet_prefer")
        .find(":selected")
        .val();
    saveSettingsDebounced();
}
async function onControlNetPixelPerfectInput() {
    extension_settings.sd.controlnet_pixelperfect = !!$(this).prop("checked");
    saveSettingsDebounced();
}
async function onControlNetWeightInput() {
    extension_settings.sd.controlnet_weight = Number(
        $("#sd_controlnet_weight").val()
    );
    $("#sd_controlnet_weight_value").text(
        extension_settings.sd.controlnet_weight.toFixed(1)
    );
    saveSettingsDebounced();
}
async function onControlNetInputRefInput() {
    extension_settings.sd.controlnet_inputRef = $("#sd_controlnet_inputRef")
        .find(":selected")
        .val();
    saveSettingsDebounced();
}
async function onControlNetAttachToInput() {
    let attachTo = [];
    $("#sd_controlnet_attachTo:checked").each(function () {
        attachTo.push($(this).val());
    });
    console.log("attachTo saving...", attachTo);
    extension_settings.sd.controlnet_attachTo = attachTo;
    saveSettingsDebounced();
}
//--------------------------------------------------
async function onHordeNsfwInput() {
    extension_settings.sd.horde_nsfw = !!$(this).prop("checked");
    saveSettingsDebounced();
}

async function onHordeKarrasInput() {
    extension_settings.sd.horde_karras = !!$(this).prop("checked");
    saveSettingsDebounced();
}

function onRestoreFacesInput() {
    extension_settings.sd.restore_faces = !!$(this).prop("checked");
    saveSettingsDebounced();
}

function onHighResFixInput() {
    extension_settings.sd.enable_hr = !!$(this).prop("checked");
    saveSettingsDebounced();
}

function onAutoUrlInput() {
    extension_settings.sd.auto_url = $("#sd_auto_url").val();
    saveSettingsDebounced();
}

function onAutoAuthInput() {
    extension_settings.sd.auto_auth = $("#sd_auto_auth").val();
    saveSettingsDebounced();
}

function onHrUpscalerChange() {
    extension_settings.sd.hr_upscaler = $("#sd_hr_upscaler")
        .find(":selected")
        .val();
    saveSettingsDebounced();
}

function onHrScaleInput() {
    extension_settings.sd.hr_scale = Number($("#sd_hr_scale").val());
    $("#sd_hr_scale_value").text(extension_settings.sd.hr_scale.toFixed(1));
    saveSettingsDebounced();
}

function onDenoisingStrengthInput() {
    extension_settings.sd.denoising_strength = Number(
        $("#sd_denoising_strength").val()
    );
    $("#sd_denoising_strength_value").text(
        extension_settings.sd.denoising_strength.toFixed(2)
    );
    saveSettingsDebounced();
}

function onHrSecondPassStepsInput() {
    extension_settings.sd.hr_second_pass_steps = Number(
        $("#sd_hr_second_pass_steps").val()
    );
    $("#sd_hr_second_pass_steps_value").text(
        extension_settings.sd.hr_second_pass_steps
    );
    saveSettingsDebounced();
}

async function validateAutoUrl() {
    try {
        if (!extension_settings.sd.auto_url) {
            throw new Error("URL is not set.");
        }

        const result = await fetch("/api/sd/ping", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error("SD WebUI returned an error.");
        }

        await loadSamplers();
        await loadModels();
        toastr.success("SD WebUI API connected.");
    } catch (error) {
        toastr.error(`Could not validate SD WebUI API: ${error.message}`);
    }
}

async function onModelChange() {
    extension_settings.sd.model = $("#sd_model").find(":selected").val();
    saveSettingsDebounced();

    const cloudSources = [sources.horde, sources.novel];

    if (cloudSources.includes(extension_settings.sd.source)) {
        return;
    }

    toastr.info("Updating remote model...", "Please wait");
    if (extension_settings.sd.source === sources.extras) {
        await updateExtrasRemoteModel();
    }
    if (extension_settings.sd.source === sources.auto) {
        await updateAutoRemoteModel();
    }
    toastr.success("Model successfully loaded!", "Stable Diffusion");
}

async function getAutoRemoteModel() {
    try {
        const result = await fetch("/api/sd/get-model", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error("SD WebUI returned an error.");
        }

        const data = await result.text();
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getAutoRemoteUpscalers() {
    try {
        const result = await fetch("/api/sd/upscalers", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error("SD WebUI returned an error.");
        }

        const data = await result.json();
        return data;
    } catch (error) {
        console.error(error);
        return [extension_settings.sd.hr_upscaler];
    }
}

async function updateAutoRemoteModel() {
    try {
        const result = await fetch("/api/sd/set-model", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify({
                ...getAutoRequestBody(),
                model: extension_settings.sd.model,
            }),
        });

        if (!result.ok) {
            throw new Error("SD WebUI returned an error.");
        }

        console.log("Model successfully updated on SD WebUI remote.");
    } catch (error) {
        console.error(error);
        toastr.error(`Could not update SD WebUI model: ${error.message}`);
    }
}

async function updateExtrasRemoteModel() {
    const url = new URL(getApiUrl());
    url.pathname = "/api/image/model";
    const getCurrentModelResult = await doExtrasFetch(url, {
        method: "POST",
        body: JSON.stringify({ model: extension_settings.sd.model }),
    });

    if (getCurrentModelResult.ok) {
        console.log("Model successfully updated on SD remote.");
    }
}

async function loadSamplers() {
    $("#sd_sampler").empty();
    let samplers = [];

    switch (extension_settings.sd.source) {
        case sources.extras:
            samplers = await loadExtrasSamplers();
            break;
        case sources.horde:
            samplers = await loadHordeSamplers();
            break;
        case sources.auto:
            samplers = await loadAutoSamplers();
            break;
        case sources.novel:
            samplers = await loadNovelSamplers();
            break;
    }

    for (const sampler of samplers) {
        const option = document.createElement("option");
        option.innerText = sampler;
        option.value = sampler;
        option.selected = sampler === extension_settings.sd.sampler;
        $("#sd_sampler").append(option);
    }
}

async function loadHordeSamplers() {
    const result = await fetch("/horde_samplers", {
        method: "POST",
        headers: getRequestHeaders(),
    });

    if (result.ok) {
        const data = await result.json();
        return data;
    }

    return [];
}

async function loadExtrasSamplers() {
    if (!modules.includes("sd")) {
        return [];
    }

    const url = new URL(getApiUrl());
    url.pathname = "/api/image/samplers";
    const result = await doExtrasFetch(url);

    if (result.ok) {
        const data = await result.json();
        return data.samplers;
    }

    return [];
}

async function loadAutoSamplers() {
    if (!extension_settings.sd.auto_url) {
        return [];
    }

    try {
        const result = await fetch("/api/sd/samplers", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error("SD WebUI returned an error.");
        }

        const data = await result.json();
        return data;
    } catch (error) {
        return [];
    }
}

async function loadNovelSamplers() {
    if (!secret_state[SECRET_KEYS.NOVEL]) {
        console.debug("NovelAI API key is not set.");
        return [];
    }

    return [
        "k_dpmpp_2m",
        "k_dpmpp_sde",
        "k_dpmpp_2s_ancestral",
        "k_euler",
        "k_euler_ancestral",
        "k_dpm_fast",
        "ddim",
    ];
}

async function loadModels() {
    $("#sd_model").empty();
    let models = [];

    switch (extension_settings.sd.source) {
        case sources.extras:
            models = await loadExtrasModels();
            break;
        case sources.horde:
            models = await loadHordeModels();
            break;
        case sources.auto:
            models = await loadAutoModels();
            break;
        case sources.novel:
            models = await loadNovelModels();
            break;
    }

    for (const model of models) {
        const option = document.createElement("option");
        option.innerText = model.text;
        option.value = model.value;
        option.selected = model.value === extension_settings.sd.model;
        $("#sd_model").append(option);
    }
}

async function loadHordeModels() {
    const result = await fetch("/horde_models", {
        method: "POST",
        headers: getRequestHeaders(),
    });

    if (result.ok) {
        const data = await result.json();
        data.sort((a, b) => b.count - a.count);
        const models = data.map((x) => ({
            value: x.name,
            text: `${x.name} (ETA: ${x.eta}s, Queue: ${x.queued}, Workers: ${x.count})`,
        }));
        return models;
    }

    return [];
}

async function loadExtrasModels() {
    if (!modules.includes("sd")) {
        return [];
    }

    const url = new URL(getApiUrl());
    url.pathname = "/api/image/model";
    const getCurrentModelResult = await doExtrasFetch(url);

    if (getCurrentModelResult.ok) {
        const data = await getCurrentModelResult.json();
        extension_settings.sd.model = data.model;
    }

    url.pathname = "/api/image/models";
    const getModelsResult = await doExtrasFetch(url);

    if (getModelsResult.ok) {
        const data = await getModelsResult.json();
        const view_models = data.models.map((x) => ({ value: x, text: x }));
        return view_models;
    }

    return [];
}

async function loadAutoModels() {
    if (!extension_settings.sd.auto_url) {
        return [];
    }

    try {
        const currentModel = await getAutoRemoteModel();

        if (currentModel) {
            extension_settings.sd.model = currentModel;
        }

        const result = await fetch("/api/sd/models", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error("SD WebUI returned an error.");
        }

        const upscalers = await getAutoRemoteUpscalers();

        if (Array.isArray(upscalers) && upscalers.length > 0) {
            $("#sd_hr_upscaler").empty();

            for (const upscaler of upscalers) {
                const option = document.createElement("option");
                option.innerText = upscaler;
                option.value = upscaler;
                option.selected =
                    upscaler === extension_settings.sd.hr_upscaler;
                $("#sd_hr_upscaler").append(option);
            }
        }

        const data = await result.json();
        return data;
    } catch (error) {
        return [];
    }
}

async function loadNovelModels() {
    if (!secret_state[SECRET_KEYS.NOVEL]) {
        console.debug("NovelAI API key is not set.");
        return [];
    }

    return [
        {
            value: "nai-diffusion",
            text: "Full",
        },
        {
            value: "safe-diffusion",
            text: "Safe",
        },
        {
            value: "nai-diffusion-furry",
            text: "Furry",
        },
    ];
}

function getGenerationType(prompt) {
    for (const [key, values] of Object.entries(triggerWords)) {
        for (const value of values) {
            if (value.toLowerCase() === prompt.toLowerCase().trim()) {
                return Number(key);
            }
        }
    }

    return generationMode.FREE;
}

function getQuietPrompt(mode, trigger) {
    if (mode === generationMode.FREE) {
        return trigger;
    }

    return stringFormat(extension_settings.sd.prompts[mode], trigger);
}

function processReply(str) {
    if (!str) {
        return "";
    }

    str = str.replaceAll('"', "");
    str = str.replaceAll("“", "");
    str = str.replaceAll(".", ",");
    str = str.replaceAll("\n", ", ");
    str = str.replace(/[^a-zA-Z0-9,:()]+/g, " "); // Replace everything except alphanumeric characters and commas with spaces
    str = str.replace(/\s+/g, " "); // Collapse multiple whitespaces into one
    str = str.trim();

    str = str
        .split(",") // list split by commas
        .map((x) => x.trim()) // trim each entry
        .filter((x) => x) // remove empty entries
        .join(", "); // join it back with proper spacing

    return str;
}

function getRawLastMessage() {
    const getLastUsableMessage = () => {
        for (const message of context.chat.slice().reverse()) {
            if (message.is_system) {
                continue;
            }

            return message.mes;
        }

        toastr.warning("No usable messages found.", "Stable Diffusion");
        throw new Error("No usable messages found.");
    };

    const context = getContext();
    const lastMessage = getLastUsableMessage(),
        characterDescription =
            context.characters[context.characterId].description,
        situation = context.characters[context.characterId].scenario;
    return `((${processReply(lastMessage)})), (${processReply(
        situation
    )}:0.7), (${processReply(characterDescription)}:0.5)`;
}

async function generatePicture(_, trigger, message, callback) {
    if (!trigger || trigger.trim().length === 0) {
        console.log("Trigger word empty, aborting");
        return;
    }

    if (!isValidState()) {
        toastr.warning(
            "Extensions API is not connected or doesn't provide SD module. Enable Stable Horde to generate images."
        );
        return;
    }

    extension_settings.sd.sampler = $("#sd_sampler").find(":selected").val();
    extension_settings.sd.model = $("#sd_model").find(":selected").val();

    trigger = trigger.trim();
    const generationType = getGenerationType(trigger);
    console.log("Generation mode", generationType, "triggered with", trigger);
    const quiet_prompt = getQuietPrompt(generationType, trigger);
    const context = getContext();

    // if context.characterId is not null, then we get context.characters[context.characterId].avatar, else we get groupId and context.groups[groupId].id
    // sadly, groups is not an array, but is a dict with keys being index numbers, so we have to filter it
    const characterName = context.characterId
        ? context.characters[context.characterId].name
        : context.groups[
              Object.keys(context.groups).filter(
                  (x) => context.groups[x].id === context.groupId
              )[0]
          ].id.toString();

    const prevSDHeight = extension_settings.sd.height;
    const prevSDWidth = extension_settings.sd.width;
    const aspectRatio =
        extension_settings.sd.width / extension_settings.sd.height;

    // Face images are always portrait (pun intended)
    if (generationType == generationMode.FACE && aspectRatio >= 1) {
        // Round to nearest multiple of 64
        extension_settings.sd.height =
            Math.round((extension_settings.sd.width * 1.5) / 64) * 64;
    }

    if (generationType == generationMode.BACKGROUND) {
        // Background images are always landscape
        if (aspectRatio <= 1) {
            // Round to nearest multiple of 64
            extension_settings.sd.width =
                Math.round((extension_settings.sd.height * 1.8) / 64) * 64;
        }
        const callbackOriginal = callback;
        callback = async function (prompt, base64Image) {
            const imagePath = base64Image;
            const imgUrl = `url("${encodeURI(base64Image)}")`;
            eventSource.emit(event_types.FORCE_SET_BACKGROUND, imgUrl);

            if (typeof callbackOriginal === "function") {
                callbackOriginal(prompt, imagePath);
            } else {
                sendMessage(prompt, imagePath);
            }
        };
    }

    try {
        const prompt = await getPrompt(
            generationType,
            message,
            trigger,
            quiet_prompt
        );
        console.log("Processed Stable Diffusion prompt:", prompt);

        context.deactivateSendButtons();
        hideSwipeButtons();

        await sendGenerationRequest(
            generationType,
            prompt,
            characterName,
            callback
        );
    } catch (err) {
        console.trace(err);
        throw new Error("SD prompt text generation failed.");
    } finally {
        extension_settings.sd.height = prevSDHeight;
        extension_settings.sd.width = prevSDWidth;
        context.activateSendButtons();
        showSwipeButtons();
    }
}

async function getPrompt(generationType, message, trigger, quiet_prompt) {
    let prompt;

    switch (generationType) {
        case generationMode.RAW_LAST:
            prompt = message || getRawLastMessage();
            break;
        case generationMode.FREE:
            prompt = trigger.trim();
            break;
        default:
            prompt = await generatePrompt(quiet_prompt);
            break;
    }

    if (generationType !== generationMode.FREE) {
        prompt = await refinePrompt(prompt);
    }

    return prompt;
}

async function generatePrompt(quiet_prompt) {
    const reply = await generateQuietPrompt(quiet_prompt);
    return processReply(reply);
}

async function sendGenerationRequest(
    generationType,
    prompt,
    characterName = null,
    callback
) {
    //for controlnet.
    rememberThePromptTypeForControlNetPleasePalThanks = generationType;
    const prefix =
        generationType !== generationMode.BACKGROUND
            ? combinePrefixes(
                  extension_settings.sd.prompt_prefix,
                  getCharacterPrefix()
              )
            : extension_settings.sd.prompt_prefix;

    const prefixedPrompt = combinePrefixes(prefix, prompt);

    let result = { format: "", data: "" };
    const currentChatId = getCurrentChatId();

    try {
        switch (extension_settings.sd.source) {
            case sources.extras:
                result = await generateExtrasImage(prefixedPrompt);
                break;
            case sources.horde:
                result = await generateHordeImage(prefixedPrompt);
                break;
            case sources.auto:
                result = await generateAutoImage(prefixedPrompt);
                break;
            case sources.novel:
                result = await generateNovelImage(prefixedPrompt);
                break;
        }

        if (!result.data) {
            throw new Error();
        }
    } catch (err) {
        toastr.error(
            "Image generation failed. Please try again",
            "Stable Diffusion"
        );
        return;
    }

    if (currentChatId !== getCurrentChatId()) {
        console.warn("Chat changed, aborting SD result saving");
        toastr.warning(
            "Chat changed, generated image discarded.",
            "Stable Diffusion"
        );
        return;
    }

    const filename = `${characterName}_${humanizedDateTime()}`;
    const base64Image = await saveBase64AsFile(
        result.data,
        characterName,
        filename,
        result.format
    );
    callback ? callback(prompt, base64Image) : sendMessage(prompt, base64Image);
}

/**
 * Generates an "extras" image using a provided prompt and other settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateExtrasImage(prompt) {
    const url = new URL(getApiUrl());
    url.pathname = "/api/image";
    const result = await doExtrasFetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.sd.sampler,
            steps: extension_settings.sd.steps,
            scale: extension_settings.sd.scale,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            negative_prompt: extension_settings.sd.negative_prompt,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
            karras: !!extension_settings.sd.horde_karras,
            hr_upscaler: extension_settings.sd.hr_upscaler,
            hr_scale: extension_settings.sd.hr_scale,
            denoising_strength: extension_settings.sd.denoising_strength,
            hr_second_pass_steps: extension_settings.sd.hr_second_pass_steps,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: "jpg", data: data.image };
    } else {
        throw new Error();
    }
}

/**
 * Generates a "horde" image using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateHordeImage(prompt) {
    const result = await fetch("/horde_generateimage", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.sd.sampler,
            steps: extension_settings.sd.steps,
            scale: extension_settings.sd.scale,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            negative_prompt: extension_settings.sd.negative_prompt,
            model: extension_settings.sd.model,
            nsfw: extension_settings.sd.horde_nsfw,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
        }),
    });

    if (result.ok) {
        const data = await result.text();
        return { format: "webp", data: data };
    } else {
        throw new Error();
    }
}

/** CONTROLNET --------------
 * Downloads the image and converts it to a base64 string, then returns an object with the necessary arguments for the ControlNet script.
 * @async
 * @function addControlNet
 * @returns {Object|boolean} An object with the necessary arguments for the ControlNet script, or false if an error occurs.
 */
async function addControlNet() {
    console.log("addControlNet");
    console.log("remember", rememberThePromptTypeForControlNetPleasePalThanks);
    // Get character filename
    const context = getContext();
    let srcValue = null;
    let base64Data = null;

    if (
        !extension_settings.sd.controlnet_attachTo.includes(
            rememberThePromptTypeForControlNetPleasePalThanks.toString()
        )
    ) {
        console.log(
            "Controlnet will not be used. Your orders. No mine",
            rememberThePromptTypeForControlNetPleasePalThanks
        );
        return false;
    }
    //INPUTREF ----
    try {
        switch (extension_settings.sd.controlnet_inputRef) {
            case "char":
                srcValue =
                    "/characters/" +
                    context.characters[context.characterId].avatar;
                break;
            //not really tested this one cause who wants to see their own face mangled by SD?
            case "user":
                console.log("user");
                //will slice out 10 entries then look for user in the chat log
                //probably a better way to do this....
                const user = $(context.chat)
                    .slice(0, 10)
                    .filter(function () {
                        return this.is_user === true;
                    });
                srcValue = user[0].avatar ?? null;
                if (!srcValue) {
                    srcValue = $("div[is_user='true'] .avatar img").attr("src");
                    if (!srcValue) return false;
                }

                break;
            //This probably work...who the fuck knows.
            case "char-expression":
                console.log("char-expression");
                console.log("In expression");
                srcValue = $("#expression-image").attr("src");
                if (!srcValue) {
                    srcValue =
                        "characters/" +
                        context.characters[context.characterId].avatar;
                }
                break;
        }
    } catch (e) {
        console.error(e);
    }

    if (!srcValue) {
        console.warn("No srcValue for ControlNet...");
        return false;
    }
    //If nae forward flash, add it. Cause eh need it.
    if (!srcValue.startsWith("/")) {
        srcValue = "/" + srcValue;
    }
    //--------------
    //--------------
    // Construct the full URL
    const url = window.location.origin + srcValue;
    console.log("read this image: ", url);
    // Download the image and convert it to a base64 string
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn("Error reading image for ControlNet", url);
            return false; //Do not use controlnet
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        base64Data = await new Promise((resolve) => {
            reader.onloadend = () => {
                resolve(reader.result);
            };
        });
    } catch (e) {
        console.error(e);
    }
    // Return the object with the necessary arguments for the ControlNet script
    const cNet = {
        //steps: extension_settings.sd.steps, //might override later... da ken pal
        //cfg_scale: extension_settings.sd.scale, //might override later... da ken pal
        //sampler_name: "Euler a", //might override later
        alwayson_scripts: {
            controlnet: {
                args: [
                    {
                        enabled: true,
                        input_image: base64Data,
                        module: "reference_only", // local SD module
                        //model: "", //local SD model
                        weight: extension_settings.sd.controlnet_weight,
                        //"resize_mode": "Inner Fit (Scale to Fit)",
                        //lowvram: true,//"processor_res": 64, //threshold_b: 200,//threshold_b: 130, //255.0  //control_mode: "ControlNet is more important",//resize_mode: 1, //guessmode: true,//"rgbbgr_mode": false
                        threshold_a: 0.5, //TODO: Add a slider for this if prefer is Balanced
                        control_mode: extension_settings.sd.controlnet_prefer,
                        resize_mode: "Crop and Resize",
                        pixel_perfect:
                            extension_settings.sd.controlnet_pixelperfect,
                        guidance_start: 0, //TODO: Add a slider for this
                        guidance_end: 1, //TODO: Add a slider for this
                    },
                ],
            },
        },
    };
    //console.log("cNet", cNet);
    return cNet;
}
/**
 * Generates an image in SD WebUI API using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateAutoImage(prompt) {
    const postBody = {
        ...getAutoRequestBody(),
        prompt: prompt,
        negative_prompt: extension_settings.sd.negative_prompt,
        sampler_name: extension_settings.sd.sampler,
        steps: extension_settings.sd.steps,
        cfg_scale: extension_settings.sd.scale,
        width: extension_settings.sd.width,
        height: extension_settings.sd.height,
        restore_faces: !!extension_settings.sd.restore_faces,
        enable_hr: !!extension_settings.sd.enable_hr,
        hr_upscaler: extension_settings.sd.hr_upscaler,
        hr_scale: extension_settings.sd.hr_scale,
        denoising_strength: extension_settings.sd.denoising_strength,
        hr_second_pass_steps: extension_settings.sd.hr_second_pass_steps,
        // Ensure generated img is saved to disk
        save_images: true,
        send_images: true,
        do_not_save_grid: false,
        do_not_save_samples: false,
    };
    //ControlNet add
    const controlNet = (await addControlNet()) || {}; //added by vincedundee
    console.log("ControlNet merge", {
        ...postBody,
        ...controlNet,
    });

    const result = await fetch("/api/sd/generate", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({
            ...postBody,
            ...controlNet,
        }),
    });
    //-------------------------

    if (result.ok) {
        const data = await result.json();
        return { format: "png", data: data.images[0] };
    } else {
        throw new Error();
    }
}

/**
 * Generates an image in NovelAI API using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateNovelImage(prompt) {
    const { steps, width, height } = getNovelParams();

    const result = await fetch("/api/novelai/generate-image", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({
            prompt: prompt,
            model: extension_settings.sd.model,
            sampler: extension_settings.sd.sampler,
            steps: steps,
            scale: extension_settings.sd.scale,
            width: width,
            height: height,
            negative_prompt: extension_settings.sd.negative_prompt,
            upscale_ratio: extension_settings.sd.novel_upscale_ratio,
        }),
    });

    if (result.ok) {
        const data = await result.text();
        return { format: "png", data: data };
    } else {
        throw new Error();
    }
}

/**
 * Adjusts extension parameters for NovelAI. Applies Anlas guard if needed.
 * @returns {{steps: number, width: number, height: number}} - A tuple of parameters for NovelAI API.
 */
function getNovelParams() {
    let steps = extension_settings.sd.steps;
    let width = extension_settings.sd.width;
    let height = extension_settings.sd.height;

    // Don't apply Anlas guard if it's disabled.d
    if (!extension_settings.sd.novel_anlas_guard) {
        return { steps, width, height };
    }

    const MAX_STEPS = 28;
    const MAX_PIXELS = 409600;

    if (width * height > MAX_PIXELS) {
        const ratio = Math.sqrt(MAX_PIXELS / (width * height));

        // Calculate new width and height while maintaining aspect ratio.
        var newWidth = Math.round(width * ratio);
        var newHeight = Math.round(height * ratio);

        // Ensure new dimensions are multiples of 64. If not, reduce accordingly.
        if (newWidth % 64 !== 0) {
            newWidth = newWidth - (newWidth % 64);
        }

        if (newHeight % 64 !== 0) {
            newHeight = newHeight - (newHeight % 64);
        }

        // If total pixel count after rounding still exceeds MAX_PIXELS, decrease dimension size by 64 accordingly.
        while (newWidth * newHeight > MAX_PIXELS) {
            if (newWidth > newHeight) {
                newWidth -= 64;
            } else {
                newHeight -= 64;
            }
        }

        console.log(
            `Anlas Guard: Image size (${width}x${height}) > ${MAX_PIXELS}, reducing size to ${newWidth}x${newHeight}`
        );
        width = newWidth;
        height = newHeight;
    }

    if (steps > MAX_STEPS) {
        console.log(
            `Anlas Guard: Steps (${steps}) > ${MAX_STEPS}, reducing steps to ${MAX_STEPS}`
        );
        steps = MAX_STEPS;
    }

    return { steps, width, height };
}

async function sendMessage(prompt, image) {
    const context = getContext();
    const messageText = `[${context.name2} sends a picture that contains: ${prompt}]`;
    const message = {
        name: context.groupId ? systemUserName : context.name2,
        is_user: false,
        is_system: true,
        is_name: true,
        send_date: getMessageTimeStamp(),
        mes: context.groupId ? p(messageText) : messageText,
        extra: {
            image: image,
            title: prompt,
        },
    };
    context.chat.push(message);
    context.addOneMessage(message);
    context.saveChat();
}

function addSDGenButtons() {
    const buttonHtml = `
    <div id="sd_gen" class="list-group-item flex-container flexGap5">
        <div class="fa-solid fa-paintbrush extensionsMenuExtensionButton" title="Trigger Stable Diffusion" /></div>
        Stable Diffusion
    </div>
        `;

    const waitButtonHtml = `
        <div id="sd_gen_wait" class="fa-solid fa-hourglass-half" /></div>
    `;
    const dropdownHtml = `
    <div id="sd_dropdown">
        <ul class="list-group">
        <span>Send me a picture of:</span>
            <li class="list-group-item" id="sd_you" data-value="you">Yourself</li>
            <li class="list-group-item" id="sd_face" data-value="face">Your Face</li>
            <li class="list-group-item" id="sd_me" data-value="me">Me</li>
            <li class="list-group-item" id="sd_world" data-value="world">The Whole Story</li>
            <li class="list-group-item" id="sd_last" data-value="last">The Last Message</li>
            <li class="list-group-item" id="sd_raw_last" data-value="raw_last">Raw Last Message</li>
            <li class="list-group-item" id="sd_background" data-value="background">Background</li>
        </ul>
    </div>`;

    $("#extensionsMenu").prepend(buttonHtml);
    $("#extensionsMenu").prepend(waitButtonHtml);
    $(document.body).append(dropdownHtml);

    const messageButton = $(".sd_message_gen");
    const button = $("#sd_gen");
    const waitButton = $("#sd_gen_wait");
    const dropdown = $("#sd_dropdown");
    waitButton.hide();
    dropdown.hide();
    button.hide();
    messageButton.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: "top",
    });

    $(document).on("click", ".sd_message_gen", sdMessageButton);

    $(document).on("click touchend", function (e) {
        const target = $(e.target);
        if (target.is(dropdown)) return;
        if (
            target.is(button) &&
            !dropdown.is(":visible") &&
            $("#send_but").is(":visible")
        ) {
            e.preventDefault();

            dropdown.fadeIn(250);
            popper.update();
        } else {
            dropdown.fadeOut(250);
        }
    });
}

function isValidState() {
    switch (extension_settings.sd.source) {
        case sources.extras:
            return modules.includes("sd");
        case sources.horde:
            return true;
        case sources.auto:
            return !!extension_settings.sd.auto_url;
        case sources.novel:
            return secret_state[SECRET_KEYS.NOVEL];
    }
}

async function moduleWorker() {
    if (isValidState()) {
        $("#sd_gen").show();
        $(".sd_message_gen").show();
    } else {
        $("#sd_gen").hide();
        $(".sd_message_gen").hide();
    }
}

addSDGenButtons();
setInterval(moduleWorker, UPDATE_INTERVAL);

async function sdMessageButton(e) {
    function setBusyIcon(isBusy) {
        $icon.toggleClass("fa-paintbrush", !isBusy);
        $icon.toggleClass(busyClass, isBusy);
    }

    const busyClass = "fa-hourglass";
    const context = getContext();
    const $icon = $(e.currentTarget);
    const $mes = $icon.closest(".mes");
    const message_id = $mes.attr("mesid");
    const message = context.chat[message_id];
    const characterName = message?.name || context.name2;
    const characterFileName = context.characterId
        ? context.characters[context.characterId].name
        : context.groups[
              Object.keys(context.groups).filter(
                  (x) => context.groups[x].id === context.groupId
              )[0]
          ].id.toString();
    const messageText = message?.mes;
    const hasSavedImage = message?.extra?.image && message?.extra?.title;

    if ($icon.hasClass(busyClass)) {
        console.log("Previous image is still being generated...");
        return;
    }

    try {
        setBusyIcon(true);
        if (hasSavedImage) {
            const prompt = await refinePrompt(message.extra.title);
            message.extra.title = prompt;

            console.log(
                "Regenerating an image, using existing prompt:",
                prompt
            );
            await sendGenerationRequest(
                generationMode.FREE,
                prompt,
                characterFileName,
                saveGeneratedImage
            );
        } else {
            console.log("doing /sd raw last");
            await generatePicture(
                "sd",
                "raw_last",
                `${characterName} said: ${messageText}`,
                saveGeneratedImage
            );
        }
    } catch (error) {
        console.error("Could not generate inline image: ", error);
    } finally {
        setBusyIcon(false);
    }

    function saveGeneratedImage(prompt, image) {
        // Some message sources may not create the extra object
        if (typeof message.extra !== "object") {
            message.extra = {};
        }

        // If already contains an image and it's not inline - leave it as is
        message.extra.inline_image =
            message.extra.image && !message.extra.inline_image ? false : true;
        message.extra.image = image;
        message.extra.title = prompt;
        appendImageToMessage(message, $mes);

        context.saveChat();
    }
}

$("#sd_dropdown [id]").on("click", function () {
    const id = $(this).attr("id");
    const idParamMap = {
        sd_you: "you",
        sd_face: "face",
        sd_me: "me",
        sd_world: "scene",
        sd_last: "last",
        sd_raw_last: "raw_last",
        sd_background: "background",
    };

    const param = idParamMap[id];

    if (param) {
        console.log("doing /sd " + param);
        generatePicture("sd", param);
    }
});

jQuery(async () => {
    getContext().registerSlashCommand(
        "sd",
        generatePicture,
        [],
        helpString,
        true,
        true
    );

    $("#extensions_settings").append(
        renderExtensionTemplate("stable-diffusion", "settings", defaultSettings)
    );
    //ControlNet ------------------------
    $("#sd_controlnet_mode").on("input", onControlNetInput);
    $("#sd_controlnet_prefer").on("change", onControlNetPreferInput);
    $("#sd_controlnet_weight").on("input", onControlNetWeightInput);
    $("#sd_controlnet_pixelperfect").on("input", onControlNetPixelPerfectInput);
    $("#sd_controlnet_inputRef").on("change", onControlNetInputRefInput);
    $("input[name='sd_controlnet_attachTo']").on(
        "change",
        onControlNetAttachToInput
    );
    //-----------------------------------
    $("#sd_source").on("change", onSourceChange);
    $("#sd_scale").on("input", onScaleInput);
    $("#sd_steps").on("input", onStepsInput);
    $("#sd_model").on("change", onModelChange);
    $("#sd_sampler").on("change", onSamplerChange);
    $("#sd_prompt_prefix").on("input", onPromptPrefixInput);
    $("#sd_negative_prompt").on("input", onNegativePromptInput);
    $("#sd_width").on("input", onWidthInput);
    $("#sd_height").on("input", onHeightInput);
    $("#sd_horde_nsfw").on("input", onHordeNsfwInput);
    $("#sd_horde_karras").on("input", onHordeKarrasInput);
    $("#sd_restore_faces").on("input", onRestoreFacesInput);
    $("#sd_enable_hr").on("input", onHighResFixInput);
    $("#sd_refine_mode").on("input", onRefineModeInput);
    $("#sd_character_prompt").on("input", onCharacterPromptInput);
    $("#sd_auto_validate").on("click", validateAutoUrl);
    $("#sd_auto_url").on("input", onAutoUrlInput);
    $("#sd_auto_auth").on("input", onAutoAuthInput);
    $("#sd_hr_upscaler").on("change", onHrUpscalerChange);
    $("#sd_hr_scale").on("input", onHrScaleInput);
    $("#sd_denoising_strength").on("input", onDenoisingStrengthInput);
    $("#sd_hr_second_pass_steps").on("input", onHrSecondPassStepsInput);
    $("#sd_novel_upscale_ratio").on("input", onNovelUpscaleRatioInput);
    $("#sd_novel_anlas_guard").on("input", onNovelAnlasGuardInput);
    $("#sd_novel_view_anlas").on("click", onViewAnlasClick);
    $("#sd_character_prompt_block").hide();

    $(".sd_settings .inline-drawer-toggle").on("click", function () {
        initScrollHeight($("#sd_prompt_prefix"));
        initScrollHeight($("#sd_negative_prompt"));
        initScrollHeight($("#sd_character_prompt"));
    });

    eventSource.on(event_types.EXTRAS_CONNECTED, async () => {
        await Promise.all([loadSamplers(), loadModels()]);
    });

    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    await loadSettings();
    $("body").addClass("sd");
});
