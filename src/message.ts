/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *   @ignore
 */
// import * as path from 'path'
// import * as cuid from 'cuid'

import {
  FileBox,
}                     from 'file-box'
import {
  instanceToClass,
}                     from 'clone-class'

import {
  log,
  Sayable,
}                 from './config'
import {
  Accessory,
}                 from './accessory'

import {
  Contact,
}                 from './contact'
import {
  Room,
}                 from './room'

import {
  MessagePayload,
  MessageType,
}                 from './puppet/'
/**
 * All wechat messages will be encapsulated as a Message.
 *
 * `Message` is `Sayable`,
 * [Examples/Ding-Dong-Bot]{@link https://github.com/Chatie/wechaty/blob/master/examples/ding-dong-bot.ts}
 */
export class Message extends Accessory implements Sayable {

  /**
   *
   * Static Properties
   *
   */

  // tslint:disable-next-line:variable-name
  public static readonly Type = MessageType

  /**
   * @todo add function
   */
  public static async find<T extends typeof Message>(
    this: T,
    query: any,
  ): Promise<T['prototype'] | null> {
    return (await this.findAll(query))[0]
  }

  /**
   * @todo add function
   */
  public static async findAll<T extends typeof Message>(
    this: T,
    query: any,
  ): Promise<T['prototype'][]> {
    log.verbose('Message', 'findAll(%s)', query)
    return [
      new (this as any)({ MsgId: 'id1' }),
      new (this as any)({ MsdId: 'id2' }),
    ]
  }

 /**
  * Create a Mobile Terminated Message
  *
  * "mobile originated" or "mobile terminated"
  * https://www.tatango.com/resources/video-lessons/video-mo-mt-sms-messaging/
  */
  public static create(id: string): Message {
    log.verbose('Message', 'static create(%s)', id)

    /**
     * Must NOT use `Message` at here
     * MUST use `this` at here
     *
     * because the class will be `cloneClass`-ed
     */
    const msg = new this(id)

    msg.payload = this.puppet.cacheMessagePayload.get(id)

    return msg
  }

  /**
   *
   * Instance Properties
   *
   */
  private payload?  : MessagePayload

  /**
   * @private
   */
  constructor(
    public readonly id: string,
  ) {
    super()
    log.verbose('Message', 'constructor(%s) for class %s',
                          id || '',
                          this.constructor.name,
              )

    // tslint:disable-next-line:variable-name
    const MyClass = instanceToClass(this, Message)

    if (MyClass === Message) {
      throw new Error('Message class can not be instanciated directly! See: https://github.com/Chatie/wechaty/issues/1217')
    }

    if (!this.puppet) {
      throw new Error('Message class can not be instanciated without a puppet!')
    }
  }

  /**
   * @private
   */
  public toString() {
    if (!this.isReady()) {
      return this.constructor.name
    }

    const msgStrList = [
      'Message',
      // `#${MessageDirection[this.direction]}`,
      `#${MessageType[this.type()]}`,
      '(',
        this.room() ? (this.room() + '▲') : '',
        this.from(),
        '►',
        this.to(),
      ')',
    ]
    if (this.type() === Message.Type.Text) {
      msgStrList.push(`<${this.text()}>`)
    } else {
      log.silly('Message', 'toString() for message type: ', Message.Type[this.type()])

      if (!this.payload) {
        throw new Error('no payload')
      }
      const filename = this.payload.filename
      if (!filename) {
        throw new Error('no file')
      }
      msgStrList.push(`<${filename}>`)
    }

    return msgStrList.join('')
  }
  /**
   * Get the sender from a message.
   * @returns {Contact}
   */
  public from(): Contact {
    if (!this.payload) {
      throw new Error('no payload')
    }

    // if (contact) {
    //   this.payload.from = contact
    //   return
    // }

    const fromId = this.payload.fromId
    if (!fromId) {
      throw new Error('no from')
    }

    const from = this.wechaty.Contact.load(fromId)
    return from
  }

  /**
   * Get the destination of the message
   * Message.to() will return null if a message is in a room, use Message.room() to get the room.
   * @returns {(Contact|null)}
   */
  public to(): null | Contact {
    if (!this.payload) {
      throw new Error('no payload')
    }

    const toId = this.payload.toId
    if (!toId) {
      return null
    }

    const to = this.wechaty.Contact.load(toId)
    return to
  }

  /**
   * Get the room from the message.
   * If the message is not in a room, then will return `null`
   *
   * @returns {(Room | null)}
   */
  public room(): null | Room {
    if (!this.payload) {
      throw new Error('no payload')
    }
    const roomId = this.payload.roomId
    if (!roomId) {
      return null
    }

    const room = this.wechaty.Room.load(roomId)
    return room
  }

  /**
   * Get the text content of the message
   *
   * @returns {string}
   */
  public text(): string {
    if (!this.payload) {
      throw new Error('no payload')
    }

    return this.payload.text || ''
  }

  public async say(text: string, mention?: Contact | Contact[]): Promise<void>
  public async say(file: FileBox): Promise<void>

  /**
   * Reply a Text or Media File message to the sender.
   *
   * @see {@link https://github.com/Chatie/wechaty/blob/master/examples/ding-dong-bot.ts|Examples/ding-dong-bot}
   * @param {(string | FileBox)} textOrFile
   * @param {(Contact|Contact[])} [mention]
   * @returns {Promise<void>}
   *
   * @example
   * const bot = new Wechaty()
   * bot
   * .on('message', async m => {
   *   if (/^ding$/i.test(m.text())) {
   *     await m.say('hello world')
   *     console.log('Bot REPLY: hello world')
   *     await m.say(new bot.Message(__dirname + '/wechaty.png'))
   *     console.log('Bot REPLY: Image')
   *   }
   * })
   */
  public async say(
    textOrFile : string | FileBox,
    mention?   : Contact | Contact[],
  ): Promise<void> {
    log.verbose('Message', 'say(%s, %s)',
                            textOrFile.toString(),
                            mention,
                )

    // const user = this.puppet.userSelf()
    const from = this.from()
    // const to   = this.to()
    const room = this.room()

    const mentionList = mention
                          ? Array.isArray(mention)
                            ? mention
                            : [mention]
                          : []

    if (typeof textOrFile === 'string') {
      await this.sayText(textOrFile, from, room, mentionList)
    } else {
      /**
       * File Message
       */
      await this.puppet.messageSendFile({
        roomId    : room && room.id || undefined,
        contactId : from.id,
      }, textOrFile)
    }
  }

  private async sayText(
    text        : string,
    to          : Contact,
    room        : Room | null,
    mentionList : Contact[],
  ): Promise<void> {
    if (room && mentionList.length > 0) {
      /**
       * 1 had mentioned someone
       */
      const mentionContact = mentionList[0]
      const textMentionList = mentionList.map(c => '@' + c.name()).join(' ')
      await this.puppet.messageSendText({
        contactId: mentionContact.id,
        roomId: room.id,
      }, textMentionList + ' ' + text)
    } else {
      /**
       * 2 did not mention anyone
       */
      await this.puppet.messageSendText({
        contactId : to.id,
        roomId    : room && room.id || undefined,
      }, text)
    }
  }

  public async file(): Promise<FileBox> {
    if (this.type() === Message.Type.Text) {
      throw new Error('text message no file')
    }
    const fileBox = await this.puppet.messageFile(this.id)
    return fileBox
  }

  /**
   * Get the type from the message.
   *
   * If type is equal to `MsgType.RECALLED`, {@link Message#id} is the msgId of the recalled message.
   * @see {@link MsgType}
   * @returns {WebMsgType}
   */
  public type(): MessageType {
    if (!this.payload) {
      throw new Error('no payload')
    }
    return this.payload.type || MessageType.Unknown
  }

  // public typeBak(): MessageType {
  //   log.silly('Message', 'type() = %s', WebMsgType[this.payload.type])

  //   /**
  //    * 1. A message created with rawObj
  //    */
  //   if (this.payload.type) {
  //     return this.payload.type
  //   }

  //   /**
  //    * 2. A message created with TEXT
  //    */
  //   const ext = this.extFromFile()
  //   if (!ext) {
  //     return WebMsgType.TEXT
  //   }

  //   /**
  //    * 3. A message created with local file
  //    */
  //   switch (ext.toLowerCase()) {
  //     case '.bmp':
  //     case '.jpg':
  //     case '.jpeg':
  //     case '.png':
  //       return WebMsgType.IMAGE

  //     case '.gif':
  //       return  WebMsgType.EMOTICON

  //     case '.mp4':
  //       return WebMsgType.VIDEO

  //     case '.mp3':
  //       return WebMsgType.VOICE
  //   }

  //   throw new Error('unknown type: ' + ext)
  // }

  // /**
  //  * Get the typeSub from the message.
  //  *
  //  * If message is a location message: `m.type() === MsgType.TEXT && m.typeSub() === MsgType.LOCATION`
  //  *
  //  * @see {@link MsgType}
  //  * @returns {WebMsgType}
  //  */
  // public abstract typeSub(): WebMsgType

  // /**
  //  * Get the typeApp from the message.
  //  *
  //  * @returns {WebAppMsgType}
  //  * @see {@link AppMsgType}
  //  */
  // public abstract typeApp(): WebAppMsgType

  /**
   * Check if a message is sent by self.
   *
   * @returns {boolean} - Return `true` for send from self, `false` for send from others.
   * @example
   * if (message.self()) {
   *  console.log('this message is sent by myself!')
   * }
   */
  public self(): boolean {
    const userId = this.puppet.selfId()
    const from = this.from()

    return from.id === userId
  }

  /**
   *
   * Get message mentioned contactList.
   *
   * Message event table as follows
   *
   * |                                                                            | Web  |  Mac PC Client | iOS Mobile |  android Mobile |
   * | :---                                                                       | :--: |     :----:     |   :---:    |     :---:       |
   * | [You were mentioned] tip ([有人@我]的提示)                                   |  ✘   |        √       |     √      |       √         |
   * | Identify magic code (8197) by copy & paste in mobile                       |  ✘   |        √       |     √      |       ✘         |
   * | Identify magic code (8197) by programming                                  |  ✘   |        ✘       |     ✘      |       ✘         |
   * | Identify two contacts with the same roomAlias by [You were  mentioned] tip |  ✘   |        ✘       |     √      |       √         |
   *
   * @returns {Contact[]} - Return message mentioned contactList
   *
   * @example
   * const contactList = message.mentioned()
   * console.log(contactList)
   */
  public async mentioned(): Promise<Contact[]> {
    log.verbose('Message', 'mentioned()')

    const room = this.room()
    if (this.type() !== MessageType.Text || !room ) {
      return []
    }

    // define magic code `8197` to identify @xxx
    const AT_SEPRATOR = String.fromCharCode(8197)

    const atList = this.text().split(AT_SEPRATOR)
    // console.log('atList: ', atList)
    if (atList.length === 0) return []

    // Using `filter(e => e.indexOf('@') > -1)` to filter the string without `@`
    const rawMentionedList = atList
      .filter(str => str.includes('@'))
      .map(str => multipleAt(str))

    // convert 'hello@a@b@c' to [ 'c', 'b@c', 'a@b@c' ]
    function multipleAt(str: string) {
      str = str.replace(/^.*?@/, '@')
      let name = ''
      const nameList: string[] = []
      str.split('@')
        .filter(mentionName => !!mentionName)
        .reverse()
        .forEach(mentionName => {
          // console.log('mentionName: ', mentionName)
          name = mentionName + '@' + name
          nameList.push(name.slice(0, -1)) // get rid of the `@` at beginning
        })
      return nameList
    }

    let mentionNameList: string[] = []
    // Flatten Array
    // see http://stackoverflow.com/a/10865042/1123955
    mentionNameList = mentionNameList.concat.apply([], rawMentionedList)
    // filter blank string
    mentionNameList = mentionNameList.filter(s => !!s)

    log.verbose('Message', 'mentioned() text = "%s", mentionNameList = "%s"',
                            this.text(),
                            JSON.stringify(mentionNameList),
                )

    const contactListNested = await Promise.all(
      mentionNameList.map(
        name => room.memberAll(name),
      ),
    )

    let contactList: Contact[] = []
    contactList = contactList.concat.apply([], contactListNested)

    if (contactList.length === 0) {
      log.warn('Message', `message.mentioned() can not found member using room.member() from mentionList, metion string: ${JSON.stringify(mentionNameList)}`)
    }
    return contactList
  }

  /**
   * @private
   */
  public isReady(): boolean {
    return !!this.payload
  }

  /**
   * @private
   */
  public async ready(): Promise<void> {
    log.verbose('Message', 'ready()')

    if (this.isReady()) {
      return
    }

    this.payload = await this.puppet.messagePayload(this.id)

    const fromId = this.payload.fromId
    const roomId = this.payload.roomId
    const toId   = this.payload.toId

    if (fromId) {
      await this.wechaty.Contact.load(fromId).ready()
    }
    if (roomId) {
      await this.wechaty.Room.load(roomId).ready()
    }
    if (toId) {
      await this.wechaty.Contact.load(toId).ready()
    }
  }

  // public async readyMedia(): Promise<this> {
  //   log.silly('PuppeteerMessage', 'readyMedia()')

  //   const puppet = this.puppet

  //   try {

  //     let url: string | undefined
  //     switch (this.type()) {
  //       case WebMsgType.EMOTICON:
  //         url = await puppet.bridge.getMsgEmoticon(this.id)
  //         break
  //       case WebMsgType.IMAGE:
  //         url = await puppet.bridge.getMsgImg(this.id)
  //         break
  //       case WebMsgType.VIDEO:
  //       case WebMsgType.MICROVIDEO:
  //         url = await puppet.bridge.getMsgVideo(this.id)
  //         break
  //       case WebMsgType.VOICE:
  //         url = await puppet.bridge.getMsgVoice(this.id)
  //         break

  //       case WebMsgType.APP:
  //         if (!this.rawObj) {
  //           throw new Error('no rawObj')
  //         }
  //         switch (this.typeApp()) {
  //           case WebAppMsgType.ATTACH:
  //             if (!this.rawObj.MMAppMsgDownloadUrl) {
  //               throw new Error('no MMAppMsgDownloadUrl')
  //             }
  //             // had set in Message
  //             // url = this.rawObj.MMAppMsgDownloadUrl
  //             break

  //           case WebAppMsgType.URL:
  //           case WebAppMsgType.READER_TYPE:
  //             if (!this.rawObj.Url) {
  //               throw new Error('no Url')
  //             }
  //             // had set in Message
  //             // url = this.rawObj.Url
  //             break

  //           default:
  //             const e = new Error('ready() unsupported typeApp(): ' + this.typeApp())
  //             log.warn('PuppeteerMessage', e.message)
  //             throw e
  //         }
  //         break

  //       case WebMsgType.TEXT:
  //         if (this.typeSub() === WebMsgType.LOCATION) {
  //           url = await puppet.bridge.getMsgPublicLinkImg(this.id)
  //         }
  //         break

  //       default:
  //         /**
  //          * not a support media message, do nothing.
  //          */
  //         return this
  //     }

  //     if (!url) {
  //       if (!this.payload.url) {
  //         /**
  //          * not a support media message, do nothing.
  //          */
  //         return this
  //       }
  //       url = this.payload.url
  //     }

  //     this.payload.url = url

  //   } catch (e) {
  //     log.warn('PuppeteerMessage', 'ready() exception: %s', e.message)
  //     Raven.captureException(e)
  //     throw e
  //   }

  //   return this
  // }

  /**
   * Get the read stream for attachment file
   */
  // public abstract async readyStream(): Promise<Readable>

  /**
   * Forward the received message.
   *
   * The types of messages that can be forwarded are as follows:
   *
   * The return value of {@link Message#type} matches one of the following types:
   * ```
   * MsgType {
   *   TEXT                = 1,
   *   IMAGE               = 3,
   *   VIDEO               = 43,
   *   EMOTICON            = 47,
   *   LOCATION            = 48,
   *   APP                 = 49,
   *   MICROVIDEO          = 62,
   * }
   * ```
   *
   * When the return value of {@link Message#type} is `MsgType.APP`, the return value of {@link Message#typeApp} matches one of the following types:
   * ```
   * AppMsgType {
   *   TEXT                     = 1,
   *   IMG                      = 2,
   *   VIDEO                    = 4,
   *   ATTACH                   = 6,
   *   EMOJI                    = 8,
   * }
   * ```
   * It should be noted that when forwarding ATTACH type message, if the file size is greater than 25Mb, the forwarding will fail.
   * The reason is that the server shields the web wx to download more than 25Mb files with a file size of 0.
   *
   * But if the file is uploaded by you using wechaty, you can forward it.
   * You need to detect the following conditions in the message event, which can be forwarded if it is met.
   *
   * ```javasrcipt
   * .on('message', async m => {
   *   if (m.self() && m.rawObj && m.rawObj.Signature) {
   *     // Filter the contacts you have forwarded
   *     const msg = <MediaMessage> m
   *     await msg.forward()
   *   }
   * })
   * ```
   *
   * @param {(Sayable | Sayable[])} to Room or Contact
   * The recipient of the message, the room, or the contact
   * @returns {Promise<boolean>}
   * @memberof MediaMessage
   */
  public async forward(to: Room | Contact): Promise<void> {
    log.verbose('Message', 'forward(%s)', to)

    let roomId, contactId

    if (to instanceof Room) {
      roomId = to.id
    }
    if (to instanceof Contact) {
      contactId = to.id
    }
    try {
      await this.puppet.messageForward(
        {
          contactId,
          roomId,
        },
        this.id,
      )
    } catch (e) {
      log.error('Message', 'forward(%s) exception: %s', to, e)
      throw e
    }
  }
}

export default Message
