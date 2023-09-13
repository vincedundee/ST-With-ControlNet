# ST-With-ControlNet
Modified Stable Diffusion to use the Automatic1111 ControlNet API in SillyTavern
https://github.com/SillyTavern/SillyTavern

Adds controlnet to Silly Tavern.

## To Install
## Folder: SillyTavern/public/scripts/extensions/stable-diffusion

- Backup your stable-diffusion folder
- Replace your stable-diffusion folder with the one in this repo.
- Reload your Silly Tavern
- Activate ControlNet in your settings.

Tested with ST 1.10.2 Vectors

## For better requests
You still need to prompt properly.

- Add character specific prompts for your character such as Loras, embeddings and proper promps.
- Emphasis character features in your character specific prompts. e.g. (brown hair) 
- Play around with models. Some are better than others

# Improvements that can be made...
- Would be good to eventually generate expressions from character avatar...shouldn't be that hard.
- As classify is now in webUI, can probably grab these and force them into the SD prompt.
- The keyword generator never works for me. Either fails or spits out garbage. I'll probably change it to use it's own keyword extractor.

## Why not push to Silly Tavern...
Nae idea how to push to someone else's repo and no compulsion to learn. This was just something I wanted in ST as the existing implementation didn't fit my needs. (I want consistent imagery)
