# ST-With-ControlNet
Modified Stable Diffusion to use the Automatic1111 ControlNet API

Adds controlnet to Silly Tavern.

## To Install
BACKUP your stable-diffusion folder at 
/public/scripts/extensions/stable-diffusion

Replace your stable-diffusion folder with the one in this repo.
Reload your Silly Tavern

Tested with ST 1.10.2 Vectors

## For better requests
You still need to prompt properly.

-- Add character specific prompts for your character such as Loras, embeddings and proper promps.
-- Emphasis character features in your character specific prompts. e.g. (brown hair) 
-- Play around with models. Some are better than others

# Improvements that can be made...
-- Would be good to eventually generate expressions from character avatar...shouldn't be that hard.
-- As classify is now in webUI, can probably grab these and force them into the SD prompt.
